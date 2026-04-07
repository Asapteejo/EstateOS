import { Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import type { TenantContext } from "@/lib/tenancy/context";
import { findFirstForTenant, rejectUnsafeCompanyIdInput } from "@/lib/tenancy/db";
import type {
  AdminDealCreateInput,
  AdminQuickPropertyCreateInput,
} from "@/lib/validations/deals";
import {
  ensureCompanyOnboardedEvent,
  PRODUCT_EVENT_NAMES,
  trackFirstCompanyEvent,
  trackProductEvent,
} from "@/modules/analytics/activity";
import { ensureReservationPaymentPlaceholder } from "@/modules/payment-requests/service";
import { buildReservationReference } from "@/modules/portal/mutations";
import { createPropertyForAdmin } from "@/modules/properties/mutations";
import { createTransactionForReservation } from "@/modules/transactions/mutations";

type ScopedFindFirstDelegate = { findFirst: (args?: unknown) => Promise<unknown> };

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function splitBuyerName(name: string) {
  const parts = name.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "Buyer",
    lastName: parts.slice(1).join(" ") || null,
  };
}

function decimalToNumber(value: { toNumber?: () => number } | number | null | undefined) {
  if (value == null) {
    return 0;
  }

  return typeof value === "number" ? value : value.toNumber?.() ?? Number(value);
}

function deriveReservationFee(input: {
  totalValue: number;
  firstInstallmentAmount?: number | null;
  paymentMode: "FULL" | "INSTALLMENT";
}) {
  if (input.paymentMode === "FULL") {
    return input.totalValue;
  }

  if (input.firstInstallmentAmount && input.firstInstallmentAmount > 0) {
    return Math.min(input.totalValue, input.firstInstallmentAmount);
  }

  return Math.max(1, Math.round(input.totalValue * 0.3));
}

export async function getAdminDealCreationOptions(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return {
      properties: [],
    };
  }

  const properties = await prisma.property.findMany({
    where: {
      companyId: context.companyId,
      status: {
        in: ["DRAFT", "AVAILABLE", "RESERVED"],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      title: true,
      priceFrom: true,
      units: {
        where: {
          status: {
            in: ["AVAILABLE", "RESERVED"],
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          title: true,
          unitCode: true,
          price: true,
          status: true,
        },
      },
      paymentPlans: {
        where: {
          isActive: true,
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          title: true,
          propertyUnitId: true,
          kind: true,
          installments: {
            orderBy: {
              sortOrder: "asc",
            },
            take: 1,
            select: {
              amount: true,
            },
          },
        },
      },
    },
  });

  return {
    properties: properties.map((property) => ({
      id: property.id,
      title: property.title,
      priceFrom: decimalToNumber(property.priceFrom),
      units: property.units.map((unit) => ({
        id: unit.id,
        title: unit.title,
        unitCode: unit.unitCode,
        price: decimalToNumber(unit.price),
        status: unit.status,
      })),
      paymentPlans: property.paymentPlans.map((plan) => ({
        id: plan.id,
        title: plan.title,
        propertyUnitId: plan.propertyUnitId,
        kind: plan.kind,
        firstInstallmentAmount: decimalToNumber(plan.installments[0]?.amount ?? null),
      })),
    })),
  };
}

export async function quickCreatePropertyForDeal(
  context: TenantContext,
  input: AdminQuickPropertyCreateInput & Record<string, unknown>,
) {
  rejectUnsafeCompanyIdInput(input);

  if (!featureFlags.hasDatabase || !context.companyId) {
    const price = input.price ?? 50000000;
    return {
      id: "demo-property",
      title: input.title,
      priceFrom: price,
      units: [],
      paymentPlans: [],
    };
  }

  const branch =
    context.branchId != null
      ? await prisma.branch.findFirst({
          where: {
            id: context.branchId,
            companyId: context.companyId,
          },
          select: {
            id: true,
            city: true,
            state: true,
            country: true,
          },
        })
      : await prisma.branch.findFirst({
          where: {
            companyId: context.companyId,
          },
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
            city: true,
            state: true,
            country: true,
          },
        });

  const priceFrom = input.price ?? 50000000;
  const created = await createPropertyForAdmin(context, {
    title: input.title,
    shortDescription: `${input.title} is ready to move from buyer interest to payment collection inside Estate OS.`,
    description: `${input.title} was quick-added from the Deal Board so the sales team can open a deal, send payment requests, and track collections immediately.`,
    propertyType: "APARTMENT",
    status: "AVAILABLE",
    branchId: branch?.id,
    isFeatured: false,
    priceFrom,
    priceTo: undefined,
    currency: "NGN",
    brochureDocumentId: undefined,
    videoUrl: undefined,
    locationSummary: [branch?.city, branch?.state].filter(Boolean).join(", ") || "Lagos, Nigeria",
    landmarks: [],
    hasPaymentPlan: false,
    wishlistDurationDays: undefined,
    wishlistReminderEnabled: true,
    location: {
      addressLine1: undefined,
      city: branch?.city ?? "Lagos",
      state: branch?.state ?? "Lagos",
      country: branch?.country ?? "Nigeria",
      neighborhood: undefined,
      postalCode: undefined,
    },
    features: [],
    units: [],
    media: [],
    paymentPlans: [],
  });

  return {
    id: created.id,
    title: input.title,
    priceFrom,
    units: [],
    paymentPlans: [],
  };
}

async function ensureBuyerRole(companyId: string) {
  return prisma.role.upsert({
    where: {
      companyId_name: {
        companyId,
        name: "BUYER",
      },
    },
    update: {
      label: "Buyer",
    },
    create: {
      companyId,
      name: "BUYER",
      label: "Buyer",
    },
    select: {
      id: true,
    },
  });
}

async function ensureBuyerUser(tx: Prisma.TransactionClient, input: {
  companyId: string;
  branchId: string | null;
  buyerName: string;
}) {
  const { firstName, lastName } = splitBuyerName(input.buyerName);
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const buyer = await tx.user.create({
    data: {
      clerkUserId: `manual-buyer-${token}`,
      companyId: input.companyId,
      branchId: input.branchId,
      email: `${slugify(input.buyerName) || "buyer"}+${token}@estateos.local`,
      firstName,
      lastName,
      isActive: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  });

  return buyer;
}

export async function createAdminDeal(
  context: TenantContext,
  input: AdminDealCreateInput & Record<string, unknown>,
) {
  rejectUnsafeCompanyIdInput(input);

  if (!featureFlags.hasDatabase || !context.companyId) {
    return {
      transactionId: "demo-transaction",
      redirectTo: "/admin?highlight=demo-transaction",
    };
  }

  const property = (await findFirstForTenant(
    prisma.property as ScopedFindFirstDelegate,
    context,
    {
      where: {
        id: input.propertyId,
      },
      select: {
        id: true,
        title: true,
        priceFrom: true,
      },
    } as Parameters<typeof prisma.property.findFirst>[0],
  )) as {
    id: string;
    title: string;
    priceFrom: { toNumber?: () => number } | number;
  } | null;

  if (!property) {
    throw new Error("Property not found.");
  }

  const propertyUnit = input.propertyUnitId
    ? await prisma.propertyUnit.findFirst({
        where: {
          companyId: context.companyId,
          id: input.propertyUnitId,
          propertyId: property.id,
        },
        select: {
          id: true,
          title: true,
          price: true,
        },
      })
    : null;

  if (input.propertyUnitId && !propertyUnit) {
    throw new Error("Property unit not found.");
  }

  const paymentPlan = input.paymentPlanId
    ? await prisma.paymentPlan.findFirst({
        where: {
          companyId: context.companyId,
          id: input.paymentPlanId,
          propertyId: property.id,
        },
        select: {
          id: true,
          installments: {
            orderBy: {
              sortOrder: "asc",
            },
            take: 1,
            select: {
              id: true,
              amount: true,
            },
          },
        },
      })
    : null;

  if (input.paymentPlanId && !paymentPlan) {
    throw new Error("Payment plan not found.");
  }

  const totalValue = Number(input.totalValue);
  const firstInstallment = paymentPlan?.installments[0];
  const reservationFee = deriveReservationFee({
    totalValue,
    paymentMode: input.paymentMode,
    firstInstallmentAmount: firstInstallment ? decimalToNumber(firstInstallment.amount) : null,
  });

  const branchId =
    context.branchId ??
    (
      await prisma.branch.findFirst({
        where: {
          companyId: context.companyId,
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
        },
      })
    )?.id ??
    null;

  const buyerRole = await ensureBuyerRole(context.companyId);
  const created = await prisma.$transaction(async (tx) => {
    const buyer = await ensureBuyerUser(tx, {
      companyId: context.companyId!,
      branchId,
      buyerName: input.buyerName,
    });

    await tx.userRole.upsert({
      where: {
        userId_roleId_companyId: {
          userId: buyer.id,
          roleId: buyerRole.id,
          companyId: context.companyId!,
        },
      },
      update: {},
      create: {
        userId: buyer.id,
        roleId: buyerRole.id,
        companyId: context.companyId!,
      },
    });

    const reservation = await tx.reservation.create({
      data: {
        companyId: context.companyId!,
        propertyId: property.id,
        propertyUnitId: propertyUnit?.id ?? null,
        userId: buyer.id,
        reference: buildReservationReference(),
        status: "ACTIVE",
        reservationFee,
        paymentPlanId: paymentPlan?.id ?? null,
        reservedUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        notes: "Created from admin deal board activation flow.",
      },
      select: {
        id: true,
        reference: true,
      },
    });

    const transaction = await createTransactionForReservation(tx, {
      companyId: context.companyId!,
      reservationId: reservation.id,
      propertyId: property.id,
      propertyUnitId: propertyUnit?.id ?? null,
      userId: buyer.id,
      paymentPlanId: paymentPlan?.id ?? null,
      totalValue,
      currentStage: "INQUIRY_RECEIVED",
    });

    await ensureReservationPaymentPlaceholder(tx, {
      companyId: context.companyId!,
      userId: buyer.id,
      transactionId: transaction.id,
      reservationId: reservation.id,
      reservationReference: reservation.reference,
      amount: reservationFee,
      installmentId: firstInstallment?.id ?? null,
    });

    if (propertyUnit?.id) {
      await tx.propertyUnit.update({
        where: {
          id: propertyUnit.id,
        },
        data: {
          status: "RESERVED",
        },
      });
    } else {
      await tx.property.update({
        where: {
          id: property.id,
        },
        data: {
          status: "RESERVED",
        },
      });
    }

    return {
      buyer,
      reservation,
      transaction,
    };
  });

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId ?? undefined,
    action: "CREATE",
    entityType: "Transaction",
    entityId: created.transaction.id,
    summary: `Created deal ${created.reservation.reference} for ${input.buyerName}`,
    payload: {
      propertyId: property.id,
      propertyUnitId: propertyUnit?.id ?? null,
      paymentPlanId: paymentPlan?.id ?? null,
      totalValue,
      paymentMode: input.paymentMode,
    } as Prisma.InputJsonValue,
  });

  await trackProductEvent({
    companyId: context.companyId,
    userId: created.buyer.id,
    eventName: PRODUCT_EVENT_NAMES.reservationCreated,
    summary: `Reservation ${created.reservation.reference} created`,
    payload: {
      propertyId: property.id,
      propertyUnitId: propertyUnit?.id ?? null,
    } as Prisma.InputJsonValue,
  });
  await trackProductEvent({
    companyId: context.companyId,
    userId: created.buyer.id,
    eventName: PRODUCT_EVENT_NAMES.dealCreated,
    summary: `Deal opened for ${input.buyerName}`,
    payload: {
      transactionId: created.transaction.id,
      propertyId: property.id,
    } as Prisma.InputJsonValue,
  });
  await trackFirstCompanyEvent({
    companyId: context.companyId,
    userId: context.userId ?? undefined,
    eventName: PRODUCT_EVENT_NAMES.firstDealCreated,
    summary: "Opened the first deal in the workspace.",
    payload: {
      transactionId: created.transaction.id,
      propertyId: property.id,
    } as Prisma.InputJsonValue,
  });
  await ensureCompanyOnboardedEvent(context);

  return {
    transactionId: created.transaction.id,
    redirectTo: `/admin?highlight=${encodeURIComponent(created.transaction.id)}`,
  };
}
