import { Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import type { TenantContext } from "@/lib/tenancy/context";
import { findFirstForTenant, rejectUnsafeCompanyIdInput } from "@/lib/tenancy/db";
import type { PropertyMutationInput } from "@/lib/validations/properties";
import { slugify } from "@/lib/utils";
import {
  buildPropertyVerificationUpdateInput,
  getVerificationThresholdsForCompany,
  updateVerificationState,
} from "@/modules/properties/verification";
import { getCompanyOperationalDefaults } from "@/modules/settings/service";
import {
  ensureCompanyOnboardedEvent,
  PRODUCT_EVENT_NAMES,
  trackFirstCompanyEvent,
  trackProductEvent,
} from "@/modules/analytics/activity";

type ScopedFindFirstDelegate = { findFirst: (args?: unknown) => Promise<unknown> };

type PropertyRecord = {
  id: string;
  status: string;
  title: string;
  brochureDocumentId: string | null;
};

export async function ensurePropertyBelongsToTenant(
  context: TenantContext,
  propertyId: string,
) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return null;
  }

  return (await findFirstForTenant(
    prisma.property as ScopedFindFirstDelegate,
    context,
    {
      where: {
        id: propertyId,
      },
      select: {
        id: true,
        status: true,
        title: true,
        brochureDocumentId: true,
      },
    } as Parameters<typeof prisma.property.findFirst>[0],
  )) as PropertyRecord | null;
}

async function ensureBrochureDocument(context: TenantContext, brochureDocumentId?: string) {
  if (!featureFlags.hasDatabase || !context.companyId || !brochureDocumentId) {
    return null;
  }

  const document = (await findFirstForTenant(
    prisma.document as ScopedFindFirstDelegate,
    context,
    {
      where: {
        id: brochureDocumentId,
        documentType: "BROCHURE",
        visibility: "PUBLIC",
      },
      select: {
        id: true,
      },
    } as Parameters<typeof prisma.document.findFirst>[0],
  )) as { id: string } | null;

  if (!document) {
    throw new Error("Selected brochure is invalid for this tenant.");
  }

  return document.id;
}

async function buildUniquePropertySlug(
  companyId: string,
  title: string,
  existingPropertyId?: string,
) {
  const baseSlug = slugify(title);

  const duplicates = await prisma.property.findMany({
    where: {
      companyId,
      slug: {
        startsWith: baseSlug,
      },
      ...(existingPropertyId
        ? {
            id: {
              not: existingPropertyId,
            },
          }
        : {}),
    },
    select: {
      slug: true,
    },
  });

  if (!duplicates.some((item) => item.slug === baseSlug)) {
    return baseSlug;
  }

  let suffix = duplicates.length + 1;
  let nextSlug = `${baseSlug}-${suffix}`;
  while (duplicates.some((item) => item.slug === nextSlug)) {
    suffix += 1;
    nextSlug = `${baseSlug}-${suffix}`;
  }

  return nextSlug;
}

async function syncPropertyUnits(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    propertyId: string;
    units: PropertyMutationInput["units"];
  },
) {
  const existingUnits = await tx.propertyUnit.findMany({
    where: {
      companyId: input.companyId,
      propertyId: input.propertyId,
    },
    select: {
      id: true,
      reservations: {
        select: {
          id: true,
        },
        take: 1,
      },
      transactions: {
        select: {
          id: true,
        },
        take: 1,
      },
    },
  });

  const incomingIds = new Set(input.units.map((unit) => unit.id).filter(Boolean));

  for (const existingUnit of existingUnits) {
    if (incomingIds.has(existingUnit.id)) {
      continue;
    }

    if (existingUnit.reservations.length > 0 || existingUnit.transactions.length > 0) {
      throw new Error("Units with reservation or transaction history cannot be removed.");
    }

    await tx.propertyUnit.delete({
      where: {
        id: existingUnit.id,
      },
    });
  }

  for (const unit of input.units) {
    const unitData = {
      companyId: input.companyId,
      propertyId: input.propertyId,
      unitCode: unit.unitCode,
      title: unit.title,
      status: unit.status,
      price: unit.price,
      bedrooms: unit.bedrooms,
      bathrooms: unit.bathrooms,
      sizeSqm: unit.sizeSqm,
      floor: unit.floor,
      block: unit.block,
    };

    if (unit.id) {
      await tx.propertyUnit.update({
        where: {
          id: unit.id,
        },
        data: unitData,
      });
      continue;
    }

    await tx.propertyUnit.create({
      data: unitData,
    });
  }
}

async function syncPropertyMedia(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    propertyId: string;
    media: PropertyMutationInput["media"];
  },
) {
  const existingMedia = await tx.propertyMedia.findMany({
    where: {
      companyId: input.companyId,
      propertyId: input.propertyId,
    },
    select: {
      id: true,
    },
  });

  const incomingIds = new Set(input.media.map((item) => item.id).filter(Boolean));

  for (const media of existingMedia) {
    if (!incomingIds.has(media.id)) {
      await tx.propertyMedia.delete({
        where: {
          id: media.id,
        },
      });
    }
  }

  for (const media of input.media) {
    const mediaData = {
      companyId: input.companyId,
      propertyId: input.propertyId,
      title: media.title,
      url: media.url,
      mimeType: media.mimeType,
      sortOrder: media.sortOrder,
      isPrimary: media.isPrimary,
      visibility: media.visibility,
    };

    if (media.id) {
      await tx.propertyMedia.update({
        where: {
          id: media.id,
        },
        data: mediaData,
      });
      continue;
    }

    await tx.propertyMedia.create({
      data: mediaData,
    });
  }
}

async function syncPropertyPaymentPlans(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    propertyId: string;
    plans: PropertyMutationInput["paymentPlans"];
  },
) {
  const existingPlans = await tx.paymentPlan.findMany({
    where: {
      companyId: input.companyId,
      propertyId: input.propertyId,
    },
    select: {
      id: true,
    },
  });

  const incomingIds = new Set(input.plans.map((plan) => plan.id).filter(Boolean));

  for (const existingPlan of existingPlans) {
    if (!incomingIds.has(existingPlan.id)) {
      await tx.paymentPlan.delete({
        where: {
          id: existingPlan.id,
        },
      });
    }
  }

  for (const plan of input.plans) {
    const planData = {
      companyId: input.companyId,
      propertyId: input.propertyId,
      propertyUnitId: plan.propertyUnitId,
      title: plan.title,
      kind: plan.kind,
      description: plan.description,
      scheduleDescription: plan.scheduleDescription,
      durationMonths: plan.durationMonths,
      installmentCount: plan.installmentCount ?? (plan.installments.length > 0 ? plan.installments.length : null),
      depositPercent: plan.depositPercent,
      downPaymentAmount: plan.downPaymentAmount,
      isActive: plan.isActive,
    };

    const persistedPlan = plan.id
      ? await tx.paymentPlan.update({
          where: {
            id: plan.id,
          },
          data: planData,
          select: {
            id: true,
          },
        })
      : await tx.paymentPlan.create({
          data: planData,
          select: {
            id: true,
          },
        });

    await tx.installment.deleteMany({
      where: {
        companyId: input.companyId,
        paymentPlanId: persistedPlan.id,
      },
    });

    if (plan.installments.length > 0) {
      await tx.installment.createMany({
        data: plan.installments.map((installment, index) => ({
          companyId: input.companyId,
          paymentPlanId: persistedPlan.id,
          title: installment.title,
          amount: installment.amount,
          dueInDays: installment.dueInDays,
          scheduleLabel: installment.scheduleLabel,
          sortOrder: installment.sortOrder ?? index,
        })),
      });
    }
  }
}

async function replacePropertyFeatures(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    propertyId: string;
    features: PropertyMutationInput["features"];
  },
) {
  await tx.propertyFeature.deleteMany({
    where: {
      companyId: input.companyId,
      propertyId: input.propertyId,
    },
  });

  if (input.features.length === 0) {
    return;
  }

  await tx.propertyFeature.createMany({
    data: input.features.map((feature) => ({
      companyId: input.companyId,
      propertyId: input.propertyId,
      label: feature.label,
      value: feature.value,
    })),
  });
}

function buildPropertyBaseData(
  input: PropertyMutationInput,
  slug: string,
  brochureDocumentId?: string | null,
  defaultWishlistDurationDays?: number,
) {
  return {
    title: input.title,
    slug,
    shortDescription: input.shortDescription,
    description: input.description,
    propertyType: input.propertyType,
    status: input.status,
    branchId: input.branchId,
    isFeatured: input.isFeatured,
    priceFrom: input.priceFrom,
    priceTo: input.priceTo,
    currency: input.currency,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    parkingSpaces: input.parkingSpaces,
    sizeSqm: input.sizeSqm,
    brochureDocumentId: brochureDocumentId ?? null,
    videoUrl: input.videoUrl,
    locationSummary:
      input.locationSummary ?? `${input.location.city}, ${input.location.state}`,
    landmarks: input.landmarks,
    hasPaymentPlan: input.hasPaymentPlan,
    wishlistDurationDays: input.wishlistDurationDays ?? defaultWishlistDurationDays ?? null,
    wishlistReminderEnabled: input.wishlistReminderEnabled,
  };
}

export async function createPropertyForAdmin(
  context: TenantContext,
  rawInput: PropertyMutationInput & Record<string, unknown>,
) {
  rejectUnsafeCompanyIdInput(rawInput);

  if (!featureFlags.hasDatabase || !context.companyId) {
    return {
      id: "demo-property",
      slug: slugify(rawInput.title),
      status: rawInput.status,
    };
  }

  const brochureDocumentId = await ensureBrochureDocument(context, rawInput.brochureDocumentId);
  const slug = await buildUniquePropertySlug(context.companyId, rawInput.title);
  const defaults = await getCompanyOperationalDefaults(context.companyId);
  const verificationThresholds = await getVerificationThresholdsForCompany(context.companyId);
  const verificationState = updateVerificationState(
    {
      lastVerifiedAt: null,
    },
    verificationThresholds,
  );

  const property = await prisma.$transaction(async (tx) => {
    const created = await tx.property.create({
      data: {
        companyId: context.companyId!,
        ...buildPropertyBaseData(
          rawInput,
          slug,
          brochureDocumentId,
          defaults.defaultWishlistDurationDays,
        ),
        verificationStatus: verificationState.verificationStatus,
        verificationDueAt: verificationState.verificationDueAt,
        isPubliclyVisible: verificationState.isPubliclyVisible,
        autoHiddenAt: verificationState.autoHiddenAt,
        verificationNotes: null,
      },
      select: {
        id: true,
        slug: true,
        status: true,
      },
    });

    await tx.propertyLocation.create({
      data: {
        companyId: context.companyId!,
        propertyId: created.id,
        ...rawInput.location,
      },
    });

    await replacePropertyFeatures(tx, {
      companyId: context.companyId!,
      propertyId: created.id,
      features: rawInput.features,
    });

    await syncPropertyUnits(tx, {
      companyId: context.companyId!,
      propertyId: created.id,
      units: rawInput.units,
    });

    await syncPropertyMedia(tx, {
      companyId: context.companyId!,
      propertyId: created.id,
      media: rawInput.media,
    });

    await syncPropertyPaymentPlans(tx, {
      companyId: context.companyId!,
      propertyId: created.id,
      plans: rawInput.paymentPlans,
    });

    return created;
  });

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId ?? undefined,
    action: "CREATE",
    entityType: "Property",
    entityId: property.id,
    summary: `Created property ${rawInput.title}`,
    payload: {
      slug: property.slug,
      status: property.status,
    } as Prisma.InputJsonValue,
  });

  await trackProductEvent({
    companyId: context.companyId,
    userId: context.userId ?? undefined,
    eventName: PRODUCT_EVENT_NAMES.propertyCreated,
    summary: `Created property ${rawInput.title}`,
    payload: {
      propertyId: property.id,
      slug: property.slug,
    } as Prisma.InputJsonValue,
  });
  await trackFirstCompanyEvent({
    companyId: context.companyId,
    userId: context.userId ?? undefined,
    eventName: PRODUCT_EVENT_NAMES.firstPropertyCreated,
    summary: "Created the first property in the workspace.",
    payload: {
      propertyId: property.id,
    } as Prisma.InputJsonValue,
  });
  await ensureCompanyOnboardedEvent(context);

  return property;
}

export async function updatePropertyForAdmin(
  context: TenantContext,
  propertyId: string,
  rawInput: PropertyMutationInput & Record<string, unknown>,
) {
  rejectUnsafeCompanyIdInput(rawInput);

  if (!featureFlags.hasDatabase || !context.companyId) {
    return {
      id: propertyId,
      slug: slugify(rawInput.title),
      status: rawInput.status,
    };
  }

  const existingProperty = await ensurePropertyBelongsToTenant(context, propertyId);
  if (!existingProperty) {
    throw new Error("Property not found.");
  }

  const brochureDocumentId = await ensureBrochureDocument(context, rawInput.brochureDocumentId);
  const slug = await buildUniquePropertySlug(context.companyId, rawInput.title, propertyId);
  const defaults = await getCompanyOperationalDefaults(context.companyId);

  const property = await prisma.$transaction(async (tx) => {
    const updated = await tx.property.update({
      where: {
        id: propertyId,
      },
      data: buildPropertyBaseData(
        rawInput,
        slug,
        brochureDocumentId,
        defaults.defaultWishlistDurationDays,
      ),
      select: {
        id: true,
        slug: true,
        status: true,
      },
    });

    await tx.propertyLocation.upsert({
      where: {
        propertyId,
      },
      update: rawInput.location,
      create: {
        companyId: context.companyId!,
        propertyId,
        ...rawInput.location,
      },
    });

    await replacePropertyFeatures(tx, {
      companyId: context.companyId!,
      propertyId,
      features: rawInput.features,
    });

    await syncPropertyUnits(tx, {
      companyId: context.companyId!,
      propertyId,
      units: rawInput.units,
    });

    await syncPropertyMedia(tx, {
      companyId: context.companyId!,
      propertyId,
      media: rawInput.media,
    });

    await syncPropertyPaymentPlans(tx, {
      companyId: context.companyId!,
      propertyId,
      plans: rawInput.paymentPlans,
    });

    return updated;
  });

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId ?? undefined,
    action: "UPDATE",
    entityType: "Property",
    entityId: property.id,
    summary: `Updated property ${rawInput.title}`,
    payload: {
      slug: property.slug,
      status: property.status,
    } as Prisma.InputJsonValue,
  });

  return property;
}

export async function updatePropertyStatusForAdmin(
  context: TenantContext,
  propertyId: string,
  status: "DRAFT" | "AVAILABLE" | "RESERVED" | "SOLD" | "ARCHIVED",
) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return {
      id: propertyId,
      status,
    };
  }

  const property = await ensurePropertyBelongsToTenant(context, propertyId);
  if (!property) {
    throw new Error("Property not found.");
  }

  const updated = await prisma.property.update({
    where: {
      id: propertyId,
    },
    data:
      status === "ARCHIVED"
        ? {
            status,
            verificationStatus: "HIDDEN",
            isPubliclyVisible: false,
            autoHiddenAt: new Date(),
          }
        : {
            status,
          },
    select: {
      id: true,
      status: true,
      title: true,
    },
  });

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId ?? undefined,
    action: "UPDATE",
    entityType: "Property",
    entityId: updated.id,
    summary: `Updated property status for ${updated.title} to ${status}`,
    payload: {
      previousStatus: property.status,
      nextStatus: status,
    } as Prisma.InputJsonValue,
  });

  return updated;
}

export async function verifyPropertyForAdmin(
  context: TenantContext,
  propertyId: string,
  notes?: string,
) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return {
      id: propertyId,
      verificationStatus: "VERIFIED" as const,
    };
  }

  const property = await ensurePropertyBelongsToTenant(context, propertyId);
  if (!property) {
    throw new Error("Property not found.");
  }

  const now = new Date();
  const verificationThresholds = await getVerificationThresholdsForCompany(context.companyId);
  const updated = await prisma.property.update({
    where: {
      id: propertyId,
    },
    data: buildPropertyVerificationUpdateInput(now, notes, verificationThresholds),
    select: {
      id: true,
      title: true,
      verificationStatus: true,
      lastVerifiedAt: true,
      verificationDueAt: true,
    },
  });

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId ?? undefined,
    action: "VERIFY",
    entityType: "Property",
    entityId: updated.id,
    summary: `Verified property ${updated.title}`,
    payload: {
      previousStatus: property.status,
      verifiedAt: updated.lastVerifiedAt?.toISOString(),
      verificationDueAt: updated.verificationDueAt.toISOString(),
      notes: notes?.trim() || null,
    } as Prisma.InputJsonValue,
  });

  return updated;
}
