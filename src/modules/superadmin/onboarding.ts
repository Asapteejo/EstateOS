import { Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import { prisma } from "@/lib/db/prisma";
import { assertProductionDatabaseWriteAllowed } from "@/lib/db/production-db-guard";
import { featureFlags } from "@/lib/env";
import type { TenantContext } from "@/lib/tenancy/context";
import type {
  SuperadminBillingMode,
  SuperadminCompanyOnboardingInput,
  SuperadminPlanSelection,
  SuperadminSubscriptionOverrideInput,
} from "@/lib/validations/superadmin";
import { recordBillingEvent } from "@/modules/billing/service";
import { PRODUCT_EVENT_NAMES, trackProductEvent } from "@/modules/analytics/activity";

export function normalizeCompanySlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function assertSuperadminOnboardingAccess(context: Pick<TenantContext, "isSuperAdmin">) {
  if (!context.isSuperAdmin) {
    throw new Error("Superadmin access is required.");
  }
}

export function subscriptionStatusForBillingMode(mode: SuperadminBillingMode) {
  if (mode === "TRIAL") {
    return "TRIAL" as const;
  }

  if (mode === "MANUAL_OVERRIDE") {
    return "GRANTED" as const;
  }

  return "ACTIVE" as const;
}

function providerForBillingMode(mode: SuperadminBillingMode) {
  return mode === "PAID" ? "PAYSTACK" as const : "MANUAL" as const;
}

function planDefaults(selection: SuperadminPlanSelection) {
  const common = {
    interval: "MONTHLY" as const,
    currency: "NGN",
    isActive: true,
    isPublic: selection !== "FREE",
    canBeGranted: true,
    featureFlags: {
      TRANSACTIONS: selection !== "FREE",
      ADMIN_OPERATIONS: true,
      BILLING_OVERVIEW: true,
    },
  };

  if (selection === "FREE") {
    return {
      ...common,
      code: "free",
      slug: "free-monthly",
      name: "Free",
      description: "Internal free access for onboarding, pilots, and test tenants.",
      priceAmount: 0,
    };
  }

  if (selection === "PREMIUM") {
    return {
      ...common,
      code: "premium",
      slug: "premium-monthly",
      name: "Premium",
      description: "Premium monthly operating plan for high-touch real estate operators.",
      priceAmount: 350000,
    };
  }

  return {
    ...common,
    code: "pro",
    slug: "pro-monthly",
    name: "Pro",
    description: "Pro monthly operating plan for real estate companies.",
    priceAmount: 150000,
  };
}

async function ensurePlatformPlan(
  tx: Prisma.TransactionClient,
  selection: SuperadminPlanSelection,
) {
  const defaults = planDefaults(selection);
  const existing = await tx.plan.findFirst({
    where: {
      interval: defaults.interval,
      OR: [
        { code: defaults.code },
        { code: selection },
        { slug: defaults.slug },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    return existing;
  }

  return tx.plan.create({
    data: {
      ...defaults,
      featureFlags: defaults.featureFlags as Prisma.InputJsonValue,
    },
  });
}

function buildSubscriptionMetadata(input: {
  plan: SuperadminPlanSelection;
  billingMode: SuperadminBillingMode;
  internalNote?: string;
  lifetimeInternalTest?: boolean;
}) {
  return {
    source: "superadmin_override",
    planSelection: input.plan,
    billingMode: input.billingMode,
    internalNote: input.internalNote ?? null,
    lifetimeInternalTest: input.lifetimeInternalTest === true,
    simulated: input.billingMode !== "PAID",
  } satisfies Prisma.InputJsonObject;
}

async function resolveActorDbUserId(context: TenantContext) {
  if (!context.userId || !featureFlags.hasDatabase) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ id: context.userId }, { clerkUserId: context.userId }],
    },
    select: { id: true },
  });

  return user?.id ?? null;
}

async function writeCompanyOnboardingAudit(input: {
  context: TenantContext;
  actorDbUserId: string | null;
  companyId: string;
  summary: string;
  payload: Prisma.InputJsonValue;
}) {
  await writeAuditLog({
    companyId: input.companyId,
    actorUserId: input.actorDbUserId ?? undefined,
    action: "CREATE",
    entityType: "Company",
    entityId: input.companyId,
    summary: input.summary,
    payload: input.payload,
  });

  await trackProductEvent({
    companyId: input.companyId,
    userId: input.actorDbUserId ?? undefined,
    eventName: PRODUCT_EVENT_NAMES.companyCreated,
    summary: input.summary,
    payload: input.payload,
  });
}

export async function createCompanyFromSuperadmin(
  context: TenantContext,
  input: SuperadminCompanyOnboardingInput,
) {
  assertSuperadminOnboardingAccess(context);

  if (!featureFlags.hasDatabase) {
    throw new Error("Database is required to create companies.");
  }

  const slug = normalizeCompanySlug(input.slug);
  if (!slug) {
    throw new Error("Company slug is required.");
  }

  const existingSlug = await prisma.company.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (existingSlug) {
    throw new Error("A company with this slug already exists.");
  }

  const ownerEmail = input.ownerEmail.toLowerCase();
  const actorDbUserId = await resolveActorDbUserId(context);
  const existingOwner = await prisma.user.findUnique({
    where: { email: ownerEmail },
    select: { id: true, companyId: true, email: true },
  });

  if (existingOwner?.companyId) {
    throw new Error("Owner email is already linked to another company.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const plan = await ensurePlatformPlan(tx, input.plan);
    const company = await tx.company.create({
      data: {
        name: input.companyName,
        slug,
        subdomain: slug,
        status: input.accessStatus,
        suspendedAt: input.accessStatus === "SUSPENDED" ? new Date() : null,
        suspensionReason: input.accessStatus === "SUSPENDED" ? input.internalNote ?? "Manual superadmin hold." : null,
        description: `Manually onboarded by superadmin for ${input.billingMode.toLowerCase().replace("_", " ")} access.`,
      },
    });

    const branch = await tx.branch.create({
      data: {
        companyId: company.id,
        name: "Main Office",
        slug: "main-office",
        phone: input.contactPhone,
        email: input.contactEmail,
      },
    });

    const owner = existingOwner
      ? await tx.user.update({
          where: { id: existingOwner.id },
          data: {
            companyId: company.id,
            branchId: branch.id,
            firstName: input.ownerFirstName,
            lastName: input.ownerLastName,
            phone: input.contactPhone,
            isActive: true,
          },
        })
      : await tx.user.create({
          data: {
            clerkUserId: `manual:${ownerEmail}`,
            email: ownerEmail,
            firstName: input.ownerFirstName,
            lastName: input.ownerLastName,
            phone: input.contactPhone,
            companyId: company.id,
            branchId: branch.id,
          },
        });

    const role = await tx.role.upsert({
      where: {
        companyId_name: {
          companyId: company.id,
          name: "ADMIN",
        },
      },
      create: {
        companyId: company.id,
        name: "ADMIN",
        label: "Admin",
      },
      update: {
        label: "Admin",
      },
    });

    await tx.userRole.upsert({
      where: {
        userId_roleId_companyId: {
          userId: owner.id,
          roleId: role.id,
          companyId: company.id,
        },
      },
      create: {
        userId: owner.id,
        roleId: role.id,
        companyId: company.id,
      },
      update: {},
    });

    await tx.siteSettings.create({
      data: {
        companyId: company.id,
        companyName: company.name,
        supportEmail: input.contactEmail,
        supportPhone: input.contactPhone,
      },
    });

    await tx.companyBillingSettings.create({
      data: {
        companyId: company.id,
        transactionProvider: providerForBillingMode(input.billingMode),
        subscriptionProvider: providerForBillingMode(input.billingMode),
        requireActivePlanForTransactions: true,
        requireActivePlanForAdminOps: false,
        notes: input.internalNote,
      },
    });

    const subscription = await tx.companySubscription.create({
      data: {
        companyId: company.id,
        planId: plan.id,
        status: subscriptionStatusForBillingMode(input.billingMode),
        interval: plan.interval,
        isCurrent: true,
        startsAt: new Date(),
        endsAt: input.subscriptionEndsAt ? new Date(input.subscriptionEndsAt) : null,
        grantedByUserId: input.billingMode === "MANUAL_OVERRIDE" ? actorDbUserId ?? undefined : undefined,
        grantReason: input.billingMode === "MANUAL_OVERRIDE" ? input.internalNote ?? "Manual superadmin override." : undefined,
        billingProvider: providerForBillingMode(input.billingMode),
        autoRenews: input.billingMode === "PAID",
        metadata: buildSubscriptionMetadata({
          plan: input.plan,
          billingMode: input.billingMode,
          internalNote: input.internalNote,
          lifetimeInternalTest: input.billingMode === "MANUAL_OVERRIDE" && !input.subscriptionEndsAt,
        }) as Prisma.InputJsonValue,
      },
    });

    return {
      company,
      owner,
      plan,
      subscription,
    };
  });

  await recordBillingEvent({
    companyId: result.company.id,
    subscriptionId: result.subscription.id,
    actorUserId: actorDbUserId ?? undefined,
    type: result.subscription.status === "GRANTED" ? "PLAN_GRANTED" : "PLAN_ASSIGNED",
    provider: result.subscription.billingProvider ?? undefined,
    amount: result.subscription.status === "GRANTED" ? 0 : result.plan.priceAmount.toNumber(),
    currency: result.plan.currency,
    status: result.subscription.status,
    summary: `Superadmin onboarded ${result.company.name} on ${result.plan.name}.`,
    metadata: result.subscription.metadata as Prisma.InputJsonValue,
  });

  await writeCompanyOnboardingAudit({
    context,
    actorDbUserId,
    companyId: result.company.id,
    summary: `Superadmin manually onboarded ${result.company.name}.`,
    payload: {
      slug,
      ownerEmail,
      plan: input.plan,
      billingMode: input.billingMode,
      accessStatus: input.accessStatus,
    } as Prisma.InputJsonValue,
  });

  return {
    companyId: result.company.id,
    companySlug: result.company.slug,
    ownerUserId: result.owner.id,
    subscriptionId: result.subscription.id,
  };
}

export async function overrideCompanySubscriptionFromSuperadmin(
  context: TenantContext,
  input: SuperadminSubscriptionOverrideInput,
) {
  assertSuperadminOnboardingAccess(context);

  if (!featureFlags.hasDatabase) {
    throw new Error("Database is required to override subscriptions.");
  }

  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { id: true, name: true, status: true },
  });

  if (!company) {
    throw new Error("Company not found.");
  }

  const actorDbUserId = await resolveActorDbUserId(context);

  const result = await prisma.$transaction(async (tx) => {
    const plan = await ensurePlatformPlan(tx, input.plan);

    await tx.company.update({
      where: { id: company.id },
      data: {
        status: input.accessStatus,
        suspendedAt: input.accessStatus === "SUSPENDED" ? new Date() : null,
        suspensionReason: input.accessStatus === "SUSPENDED" ? input.internalNote ?? "Suspended by superadmin override." : null,
      },
    });

    await tx.companyBillingSettings.upsert({
      where: { companyId: company.id },
      create: {
        companyId: company.id,
        transactionProvider: providerForBillingMode(input.billingMode),
        subscriptionProvider: providerForBillingMode(input.billingMode),
        notes: input.internalNote,
      },
      update: {
        transactionProvider: providerForBillingMode(input.billingMode),
        subscriptionProvider: providerForBillingMode(input.billingMode),
        notes: input.internalNote,
      },
    });

    await tx.companySubscription.updateMany({
      where: {
        companyId: company.id,
        isCurrent: true,
      },
      data: {
        isCurrent: false,
        cancelledAt: new Date(),
      },
    });

    const subscription = await tx.companySubscription.create({
      data: {
        companyId: company.id,
        planId: plan.id,
        status: subscriptionStatusForBillingMode(input.billingMode),
        interval: plan.interval,
        isCurrent: true,
        startsAt: new Date(),
        endsAt: input.lifetimeInternalTest ? null : input.subscriptionEndsAt ? new Date(input.subscriptionEndsAt) : null,
        grantedByUserId: input.billingMode === "MANUAL_OVERRIDE" ? actorDbUserId ?? undefined : undefined,
        grantReason: input.billingMode === "MANUAL_OVERRIDE" ? input.internalNote ?? "Manual superadmin override." : undefined,
        billingProvider: providerForBillingMode(input.billingMode),
        autoRenews: input.billingMode === "PAID",
        metadata: buildSubscriptionMetadata({
          plan: input.plan,
          billingMode: input.billingMode,
          internalNote: input.internalNote,
          lifetimeInternalTest: input.lifetimeInternalTest,
        }) as Prisma.InputJsonValue,
      },
    });

    return { plan, subscription };
  });

  await recordBillingEvent({
    companyId: company.id,
    subscriptionId: result.subscription.id,
    actorUserId: actorDbUserId ?? undefined,
    type: result.subscription.status === "GRANTED" ? "PLAN_GRANTED" : "PLAN_ASSIGNED",
    provider: result.subscription.billingProvider ?? undefined,
    amount: result.subscription.status === "GRANTED" ? 0 : result.plan.priceAmount.toNumber(),
    currency: result.plan.currency,
    status: result.subscription.status,
    summary: `Superadmin changed ${company.name} to ${result.plan.name}.`,
    metadata: result.subscription.metadata as Prisma.InputJsonValue,
  });

  await writeAuditLog({
    companyId: company.id,
    actorUserId: actorDbUserId ?? undefined,
    action: "BILLING",
    entityType: "CompanySubscription",
    entityId: result.subscription.id,
    summary: `Superadmin subscription override for ${company.name}.`,
    payload: {
      previousStatus: company.status,
      nextStatus: input.accessStatus,
      plan: input.plan,
      billingMode: input.billingMode,
      lifetimeInternalTest: input.lifetimeInternalTest,
      internalNote: input.internalNote ?? null,
    } as Prisma.InputJsonValue,
  });

  return {
    companyId: company.id,
    subscriptionId: result.subscription.id,
  };
}

export async function createMockCompanyFromSuperadmin(context: TenantContext) {
  assertSuperadminOnboardingAccess(context);

  if (featureFlags.isProduction) {
    throw new Error("Mock company creation is disabled in production.");
  }
  assertProductionDatabaseWriteAllowed({
    operation: "Create mock superadmin company",
    allowExplicitOverride: true,
  });

  const suffix = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const slug = normalizeCompanySlug(`mock-estates-${suffix}`);
  const result = await createCompanyFromSuperadmin(context, {
    companyName: `Mock Estates ${suffix}`,
    slug,
    contactEmail: `ops+${slug}@estateos.test`,
    contactPhone: "+2348000000000",
    ownerFirstName: "Mock",
    ownerLastName: "Admin",
    ownerEmail: `admin+${slug}@estateos.test`,
    plan: "PRO",
    billingMode: "MANUAL_OVERRIDE",
    accessStatus: "ACTIVE",
    internalNote: "Dev-only mock tenant generated for dashboard testing.",
  });

  await seedMockCompanyWorkspace(result.companyId, slug);
  return result;
}

async function seedMockCompanyWorkspace(companyId: string, slug: string) {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { id: true, name: true },
  });

  const branch = await prisma.branch.findFirst({
    where: { companyId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  const [buyer, marketer] = await prisma.$transaction([
    prisma.user.create({
      data: {
        clerkUserId: `mock:buyer:${slug}`,
        email: `buyer+${slug}@estateos.test`,
        firstName: "Ada",
        lastName: "Buyer",
        phone: "+2348011111111",
        companyId,
        branchId: branch?.id,
      },
    }),
    prisma.teamMember.create({
      data: {
        companyId,
        fullName: "Tobi Marketer",
        slug: "tobi-marketer",
        title: "Lead Marketer",
        bio: "Demo marketer for internal EstateOS workflow testing.",
        email: `marketer+${slug}@estateos.test`,
        phone: "+2348022222222",
        whatsappNumber: "+2348022222222",
        staffCode: "MOCK-001",
        sortOrder: 1,
        isPublished: true,
      },
    }),
  ]);

  const property = await prisma.property.create({
    data: {
      companyId,
      branchId: branch?.id,
      title: "Mock Lekki Smart Terraces",
      slug: "mock-lekki-smart-terraces",
      shortDescription: "Internal mock listing for EstateOS dashboard testing.",
      description: "A simulated premium terrace project used for dev and support validation only.",
      propertyType: "TERRACE",
      status: "AVAILABLE",
      isFeatured: true,
      priceFrom: 85000000,
      priceTo: 125000000,
      bedrooms: 4,
      bathrooms: 4,
      parkingSpaces: 2,
      sizeSqm: 240,
      locationSummary: "Lekki Phase 1, Lagos",
      isPubliclyVisible: true,
      verificationStatus: "VERIFIED",
      lastVerifiedAt: new Date(),
      verificationDueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  });

  await prisma.propertyUnit.create({
    data: {
      companyId,
      propertyId: property.id,
      unitCode: "MOCK-A1",
      title: "Mock Terrace A1",
      status: "AVAILABLE",
      price: 85000000,
      bedrooms: 4,
      bathrooms: 4,
      sizeSqm: 240,
      block: "A",
    },
  });

  const inquiry = await prisma.inquiry.create({
    data: {
      companyId,
      propertyId: property.id,
      userId: buyer.id,
      fullName: "Ada Buyer",
      email: buyer.email,
      phone: buyer.phone,
      message: "SIMULATED TEST inquiry for mock company onboarding.",
      source: "WEBSITE",
      status: "QUALIFIED",
      notes: "SIMULATED TEST DATA - safe for dev and support demos.",
    },
  });

  await prisma.paymentRequest.create({
    data: {
      companyId,
      userId: buyer.id,
      provider: "MANUAL",
      channel: "IN_APP",
      collectionMethod: "BANK_TRANSFER_TEMP_ACCOUNT",
      status: "DRAFT",
      title: "SIMULATED TEST reservation fee",
      purpose: "Mock company dev testing only",
      amount: 500000,
      currency: "NGN",
      dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      notes: "SIMULATED TEST - no Paystack or R2 keys required.",
      providerReference: `SIMULATED-${slug.toUpperCase()}`,
    },
  });

  await trackProductEvent({
    companyId,
    userId: buyer.id,
    inquiryId: inquiry.id,
    eventName: PRODUCT_EVENT_NAMES.sampleWorkspaceLoaded,
    summary: `${company.name} mock workspace loaded with safe sample data.`,
    payload: {
      simulated: true,
      propertyId: property.id,
      marketerId: marketer.id,
    } as Prisma.InputJsonValue,
  });
}
