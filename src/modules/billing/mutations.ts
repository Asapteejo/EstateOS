import { Prisma } from "@prisma/client";

import type { TenantContext } from "@/lib/tenancy/context";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { hasRequiredRole } from "@/lib/auth/roles";
import { addIntervalToDate } from "@/modules/billing/logic";
import { auditBillingAction, recordBillingEvent } from "@/modules/billing/service";
import type {
  BillingPlanUpsertInput,
  CompanySubscriptionAssignmentInput,
  CompanySubscriptionRevocationInput,
} from "@/lib/validations/billing";

function requireSuperAdmin(context: TenantContext) {
  if (!hasRequiredRole(context.roles, "SUPER_ADMIN")) {
    throw new Error("Only super admins can manage company billing.");
  }
}

export async function createPlan(
  context: TenantContext,
  input: BillingPlanUpsertInput,
) {
  requireSuperAdmin(context);

  if (!featureFlags.hasDatabase) {
    return {
      id: "demo-plan",
      slug: input.slug,
    };
  }

  const plan = await prisma.plan.create({
    data: {
      code: input.code,
      slug: input.slug,
      name: input.name,
      description: input.description,
      interval: input.interval,
      priceAmount: input.priceAmount,
      currency: input.currency,
      isActive: input.isActive,
      isPublic: input.isPublic,
      canBeGranted: input.canBeGranted,
      featureFlags: input.featureFlags as Prisma.InputJsonValue | undefined,
      allowances: input.allowances as Prisma.InputJsonValue | undefined,
    },
  });

  await recordBillingEvent({
    companyId: context.companyId ?? "platform",
    actorUserId: context.userId ?? undefined,
    type: "PLAN_ASSIGNED",
    summary: `Created billing plan ${plan.name}`,
    metadata: {
      planId: plan.id,
      slug: plan.slug,
      interval: plan.interval,
    } as Prisma.InputJsonValue,
  });

  await auditBillingAction({
    actorUserId: context.userId ?? undefined,
    companyId: null,
    entityType: "Plan",
    entityId: plan.id,
    summary: `Created plan ${plan.name}`,
    payload: {
      slug: plan.slug,
      interval: plan.interval,
    } as Prisma.InputJsonValue,
  });

  return plan;
}

export async function updatePlan(
  context: TenantContext,
  planId: string,
  input: BillingPlanUpsertInput,
) {
  requireSuperAdmin(context);

  if (!featureFlags.hasDatabase) {
    return {
      id: planId,
      slug: input.slug,
    };
  }

  const plan = await prisma.plan.update({
    where: {
      id: planId,
    },
    data: {
      code: input.code,
      slug: input.slug,
      name: input.name,
      description: input.description,
      interval: input.interval,
      priceAmount: input.priceAmount,
      currency: input.currency,
      isActive: input.isActive,
      isPublic: input.isPublic,
      canBeGranted: input.canBeGranted,
      featureFlags: input.featureFlags as Prisma.InputJsonValue | undefined,
      allowances: input.allowances as Prisma.InputJsonValue | undefined,
    },
  });

  await auditBillingAction({
    actorUserId: context.userId ?? undefined,
    companyId: null,
    entityType: "Plan",
    entityId: plan.id,
    summary: `Updated plan ${plan.name}`,
    payload: {
      slug: plan.slug,
      interval: plan.interval,
    } as Prisma.InputJsonValue,
  });

  return plan;
}

export async function assignCompanySubscription(
  context: TenantContext,
  input: CompanySubscriptionAssignmentInput,
) {
  requireSuperAdmin(context);

  if (!featureFlags.hasDatabase) {
    return {
      id: "demo-subscription",
      companyId: input.companyId,
      planId: input.planId,
      status: input.status,
    };
  }

  const [company, plan] = await Promise.all([
    prisma.company.findUnique({
      where: {
        id: input.companyId,
      },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.plan.findUnique({
      where: {
        id: input.planId,
      },
      select: {
        id: true,
        name: true,
        interval: true,
        canBeGranted: true,
        priceAmount: true,
        currency: true,
      },
    }),
  ]);

  if (!company) {
    throw new Error("Company not found.");
  }

  if (!plan) {
    throw new Error("Plan not found.");
  }

  if (input.status === "GRANTED" && !plan.canBeGranted) {
    throw new Error("This plan cannot be granted manually.");
  }

  const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
  const endsAt = input.endsAt
    ? new Date(input.endsAt)
    : addIntervalToDate(startsAt, input.interval ?? plan.interval);

  const subscription = await prisma.$transaction(async (tx) => {
    await tx.companySubscription.updateMany({
      where: {
        companyId: company.id,
        isCurrent: true,
      },
      data: {
        isCurrent: false,
      },
    });

    return tx.companySubscription.create({
      data: {
        companyId: company.id,
        planId: plan.id,
        status: input.status,
        interval: input.interval ?? plan.interval,
        isCurrent: true,
        startsAt,
        endsAt,
        grantedByUserId: input.status === "GRANTED" ? context.userId ?? undefined : undefined,
        grantReason: input.reason,
        billingProvider: input.billingProvider,
        autoRenews: input.autoRenews,
        externalSubscriptionId: input.externalSubscriptionId,
        externalCustomerId: input.externalCustomerId,
        metadata: {
          assignedBySuperAdmin: true,
          notes: input.notes,
        } as Prisma.InputJsonValue,
      },
    });
  });

  await recordBillingEvent({
    companyId: company.id,
    subscriptionId: subscription.id,
    actorUserId: context.userId ?? undefined,
    type: input.status === "GRANTED" ? "PLAN_GRANTED" : "PLAN_ASSIGNED",
    provider: input.billingProvider ?? undefined,
    amount: input.status === "GRANTED" ? 0 : plan.priceAmount.toNumber(),
    currency: plan.currency,
    status: input.status,
    summary: `${input.status === "GRANTED" ? "Granted" : "Assigned"} ${plan.name} to ${company.name}`,
    metadata: {
      reason: input.reason,
      notes: input.notes,
      interval: subscription.interval,
    } as Prisma.InputJsonValue,
  });

  await auditBillingAction({
    actorUserId: context.userId ?? undefined,
    companyId: company.id,
    entityType: "CompanySubscription",
    entityId: subscription.id,
    summary: `${input.status === "GRANTED" ? "Granted" : "Assigned"} ${plan.name} to ${company.name}`,
    payload: {
      companyId: company.id,
      planId: plan.id,
      status: input.status,
      reason: input.reason,
      notes: input.notes,
    } as Prisma.InputJsonValue,
  });

  return subscription;
}

export async function revokeCompanySubscription(
  context: TenantContext,
  subscriptionId: string,
  input: CompanySubscriptionRevocationInput,
) {
  requireSuperAdmin(context);

  if (!featureFlags.hasDatabase) {
    return {
      id: subscriptionId,
      status: "CANCELLED",
    };
  }

  const subscription = await prisma.companySubscription.findUnique({
    where: {
      id: subscriptionId,
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
        },
      },
      plan: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!subscription) {
    throw new Error("Subscription not found.");
  }

  const nextStatus = input.status ?? "CANCELLED";

  const updated = await prisma.companySubscription.update({
    where: {
      id: subscription.id,
    },
    data: {
      status: nextStatus,
      isCurrent: false,
      cancelledAt: new Date(),
      grantReason: input.reason ?? subscription.grantReason,
      metadata: {
        revokedBySuperAdmin: true,
        notes: input.notes,
      } as Prisma.InputJsonValue,
    },
  });

  await recordBillingEvent({
    companyId: subscription.companyId,
    subscriptionId: subscription.id,
    actorUserId: context.userId ?? undefined,
    type: "PLAN_REVOKED",
    status: nextStatus,
    summary: `Revoked ${subscription.plan.name} from ${subscription.company.name}`,
    metadata: {
      reason: input.reason,
      notes: input.notes,
    } as Prisma.InputJsonValue,
  });

  await auditBillingAction({
    actorUserId: context.userId ?? undefined,
    companyId: subscription.companyId,
    entityType: "CompanySubscription",
    entityId: subscription.id,
    summary: `Revoked ${subscription.plan.name} from ${subscription.company.name}`,
    payload: {
      nextStatus,
      reason: input.reason,
      notes: input.notes,
    } as Prisma.InputJsonValue,
  });

  return updated;
}
