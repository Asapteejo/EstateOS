import { Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import type { TenantContext } from "@/lib/tenancy/context";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { findFirstForTenant, rejectUnsafeCompanyIdInput } from "@/lib/tenancy/db";
import type { ReservationCreateInput } from "@/lib/validations/reservations";
import type { SavedPropertyMutationInput } from "@/lib/validations/saved-properties";
import { requireCompanyPlanAccess } from "@/modules/billing/service";
import { createTransactionForReservation } from "@/modules/transactions/mutations";

type ScopedFindFirstDelegate = { findFirst: (args?: unknown) => Promise<unknown> };

export function buildSavedPropertyUniqueInput(input: {
  companyId: string;
  userId: string;
  propertyId: string;
}) {
  return {
    companyId_userId_propertyId: {
      companyId: input.companyId,
      userId: input.userId,
      propertyId: input.propertyId,
    },
  };
}

export function assertReservableStatuses(input: {
  propertyStatus: string;
  unitStatus?: string | null;
}) {
  if (input.propertyStatus !== "AVAILABLE") {
    throw new Error("Property is not available for reservation.");
  }

  if (input.unitStatus && input.unitStatus !== "AVAILABLE") {
    throw new Error("Selected unit is not available for reservation.");
  }

  return true;
}

export function buildReservationReference(date = new Date()) {
  const yyyy = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  const suffix = `${Math.floor(Math.random() * 9000) + 1000}`;

  return `RSV-${yyyy}${month}${day}-${suffix}`;
}

export async function savePropertyForBuyer(
  context: TenantContext,
  input: SavedPropertyMutationInput & Record<string, unknown>,
) {
  rejectUnsafeCompanyIdInput(input);

  if (!context.companyId || !context.userId) {
    throw new Error("Authentication and tenant context are required.");
  }

  if (!featureFlags.hasDatabase) {
    return {
      status: "saved" as const,
      propertyId: input.propertyId,
    };
  }

  const property = (await findFirstForTenant(
    prisma.property as ScopedFindFirstDelegate,
    context,
    {
      where: {
        id: input.propertyId,
        status: {
          in: ["AVAILABLE", "RESERVED", "SOLD"],
        },
      },
      select: {
        id: true,
      },
    } as Parameters<typeof prisma.property.findFirst>[0],
  )) as { id: string } | null;

  if (!property) {
    throw new Error("Property not found.");
  }

  const existing = await prisma.savedProperty.findUnique({
    where: buildSavedPropertyUniqueInput({
      companyId: context.companyId,
      userId: context.userId,
      propertyId: property.id,
    }),
    select: {
      id: true,
    },
  });

  if (existing) {
    await prisma.savedProperty.delete({
      where: {
        id: existing.id,
      },
    });

    return {
      status: "removed" as const,
      propertyId: property.id,
    };
  }

  await prisma.savedProperty.create({
    data: {
      companyId: context.companyId,
      userId: context.userId,
      propertyId: property.id,
    },
  });

  return {
    status: "saved" as const,
    propertyId: property.id,
  };
}

export async function createReservationForBuyer(
  context: TenantContext,
  input: ReservationCreateInput & Record<string, unknown>,
) {
  rejectUnsafeCompanyIdInput(input);

  if (!context.companyId || !context.userId) {
    throw new Error("Authentication and tenant context are required.");
  }

  if (!featureFlags.hasDatabase) {
    return {
      reference: "RSV-DEMO-0001",
      status: "ACTIVE",
    };
  }

  await requireCompanyPlanAccess(context, "TRANSACTIONS");

  const property = (await findFirstForTenant(
    prisma.property as ScopedFindFirstDelegate,
    context,
    {
      where: {
        id: input.propertyId,
      },
      select: {
        id: true,
        status: true,
        priceFrom: true,
        title: true,
      },
    } as Parameters<typeof prisma.property.findFirst>[0],
  )) as {
    id: string;
    status: string;
    priceFrom: { toNumber?: () => number } | number;
    title: string;
  } | null;

  if (!property) {
    throw new Error("Property not found.");
  }

  let propertyUnitId: string | undefined;
  let reservationFee =
    typeof property.priceFrom === "number"
      ? property.priceFrom
      : property.priceFrom.toNumber?.() ?? Number(property.priceFrom);
  let unitStatus: string | null = null;

  if (input.propertyUnitId) {
    const unit = (await findFirstForTenant(
      prisma.propertyUnit as ScopedFindFirstDelegate,
      context,
      {
        where: {
          id: input.propertyUnitId,
          propertyId: property.id,
        },
      select: {
        id: true,
        status: true,
        price: true,
        title: true,
      },
    } as Parameters<typeof prisma.propertyUnit.findFirst>[0],
  )) as {
    id: string;
    status: string;
    price: { toNumber?: () => number } | number;
    title: string;
  } | null;

    if (!unit) {
      throw new Error("Selected unit not found.");
    }

    propertyUnitId = unit.id;
    unitStatus = unit.status;
    reservationFee =
      typeof unit.price === "number"
        ? unit.price
        : unit.price.toNumber?.() ?? Number(unit.price);
  }

  assertReservableStatuses({
    propertyStatus: property.status,
    unitStatus,
  });

  const existingReservation = await prisma.reservation.findFirst({
    where: {
      companyId: context.companyId,
      userId: context.userId,
      propertyId: property.id,
      propertyUnitId: propertyUnitId ?? null,
      status: {
        in: ["PENDING", "ACTIVE"],
      },
    },
    select: {
      id: true,
      reference: true,
      status: true,
    },
  });

  if (existingReservation) {
    return {
      reference: existingReservation.reference,
      status: existingReservation.status,
      existing: true,
    };
  }

  const created = await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.create({
      data: {
        companyId: context.companyId!,
        propertyId: property.id,
        propertyUnitId,
        userId: context.userId!,
        reference: buildReservationReference(),
        status: "PENDING",
        reservationFee,
        reservedUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
      select: {
        id: true,
        reference: true,
        status: true,
      },
    });

    await createTransactionForReservation(tx, {
      companyId: context.companyId!,
      reservationId: reservation.id,
      propertyId: property.id,
      propertyUnitId,
      userId: context.userId!,
      totalValue: reservationFee,
      currentStage: "INQUIRY_RECEIVED",
    });

    if (propertyUnitId) {
      await tx.propertyUnit.update({
        where: {
          id: propertyUnitId,
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

    return reservation;
  });

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId,
    action: "CREATE",
    entityType: "Reservation",
    entityId: created.id,
    summary: `Created reservation ${created.reference} for ${property.title}`,
    payload: {
      propertyId: property.id,
      propertyUnitId,
      reservationFee,
    } as Prisma.InputJsonValue,
  });

  return {
    reference: created.reference,
    status: created.status,
    existing: false,
  };
}
