import { Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import type { TenantContext } from "@/lib/tenancy/context";
import { findFirstForTenant } from "@/lib/tenancy/db";
import { publishDomainEvent } from "@/lib/notifications/events";
import type {
  AdminReservationStatusInput,
  AdminTransactionStageInput,
} from "@/lib/validations/transactions";
import {
  buildTransactionMilestoneState,
  canTransitionReservationStatus,
  derivePropertyStatusFromReservationStatus,
  type TransactionStageValue,
} from "@/modules/transactions/workflow";

type ScopedFindFirstDelegate = { findFirst: (args?: unknown) => Promise<unknown> };

type ReservationForOps = {
  id: string;
  companyId: string;
  propertyId: string;
  propertyUnitId: string | null;
  userId: string;
  status: "PENDING" | "ACTIVE" | "EXPIRED" | "CANCELLED" | "CONVERTED";
  reservationFee: { toNumber?: () => number } | number;
  transaction: { id: string } | null;
};

type TransactionForOps = {
  id: string;
  companyId: string;
  userId: string;
  propertyId: string;
  currentStage: TransactionStageValue;
};

function decimalToNumber(value: { toNumber?: () => number } | number) {
  return typeof value === "number" ? value : value.toNumber?.() ?? Number(value);
}

export async function syncTransactionMilestones(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    transactionId: string;
    currentStage: TransactionStageValue;
  },
) {
  const milestoneState = buildTransactionMilestoneState(input.currentStage);

  const existingMilestones = await tx.transactionMilestone.findMany({
    where: {
      companyId: input.companyId,
      transactionId: input.transactionId,
    },
    select: {
      id: true,
      stage: true,
    },
  });

  for (const milestone of milestoneState) {
    const existing = existingMilestones.find((item) => item.stage === milestone.stage);

    if (existing) {
      await tx.transactionMilestone.update({
        where: {
          id: existing.id,
        },
        data: {
          title: milestone.title,
          status: milestone.status as never,
          completedAt: milestone.completedAt,
          dueAt: milestone.status === "PENDING" ? null : undefined,
        },
      });
      continue;
    }

    await tx.transactionMilestone.create({
      data: {
        companyId: input.companyId,
        transactionId: input.transactionId,
        stage: milestone.stage,
        title: milestone.title,
        status: milestone.status as never,
        completedAt: milestone.completedAt,
      },
    });
  }
}

export async function createTransactionForReservation(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    reservationId: string;
    propertyId: string;
    propertyUnitId?: string | null;
    userId: string;
    marketerId?: string | null;
    paymentPlanId?: string | null;
    totalValue: number;
    currentStage?: TransactionStageValue;
  },
) {
  const currentStage = input.currentStage ?? "INQUIRY_RECEIVED";

  const created = await tx.transaction.create({
    data: {
      companyId: input.companyId,
      reservationId: input.reservationId,
      propertyId: input.propertyId,
      propertyUnitId: input.propertyUnitId ?? null,
      userId: input.userId,
      marketerId: input.marketerId ?? null,
      paymentPlanId: input.paymentPlanId ?? null,
      currentStage,
      totalValue: input.totalValue,
      outstandingBalance: input.totalValue,
    },
    select: {
      id: true,
      currentStage: true,
    },
  });

  await syncTransactionMilestones(tx, {
    companyId: input.companyId,
    transactionId: created.id,
    currentStage,
  });

  return created;
}

async function ensureReservationForAdmin(context: TenantContext, reservationId: string) {
  return (await findFirstForTenant(
    prisma.reservation as ScopedFindFirstDelegate,
    context,
    {
      where: {
        id: reservationId,
      },
      select: {
        id: true,
        companyId: true,
        propertyId: true,
        propertyUnitId: true,
        userId: true,
        status: true,
        reservationFee: true,
        transaction: {
          select: {
            id: true,
          },
        },
      },
    } as Parameters<typeof prisma.reservation.findFirst>[0],
  )) as ReservationForOps | null;
}

async function ensureTransactionForAdmin(context: TenantContext, transactionId: string) {
  return (await findFirstForTenant(
    prisma.transaction as ScopedFindFirstDelegate,
    context,
    {
      where: {
        id: transactionId,
      },
      select: {
        id: true,
        companyId: true,
        userId: true,
        propertyId: true,
        currentStage: true,
      },
    } as Parameters<typeof prisma.transaction.findFirst>[0],
  )) as TransactionForOps | null;
}

export async function updateReservationStatusForAdmin(
  context: TenantContext,
  reservationId: string,
  input: AdminReservationStatusInput,
) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return {
      id: reservationId,
      status: input.status,
    };
  }

  const reservation = await ensureReservationForAdmin(context, reservationId);
  if (!reservation) {
    throw new Error("Reservation not found.");
  }

  if (!canTransitionReservationStatus(reservation.status, input.status)) {
    throw new Error("Reservation status transition is not allowed.");
  }

  const propertyStatus = derivePropertyStatusFromReservationStatus(input.status);

  const result = await prisma.$transaction(async (tx) => {
    const updatedReservation = await tx.reservation.update({
      where: {
        id: reservation.id,
      },
      data: {
        status: input.status,
        notes: input.notes,
      },
      select: {
        id: true,
        status: true,
        propertyId: true,
        propertyUnitId: true,
        userId: true,
      },
    });

    if (updatedReservation.propertyUnitId) {
      await tx.propertyUnit.update({
        where: {
          id: updatedReservation.propertyUnitId,
        },
        data: {
          status: propertyStatus,
        },
      });
    } else {
      await tx.property.update({
        where: {
          id: updatedReservation.propertyId,
        },
        data: {
          status: propertyStatus,
        },
      });
    }

    if (!reservation.transaction && input.status === "ACTIVE") {
      await createTransactionForReservation(tx, {
        companyId: context.companyId!,
        reservationId: reservation.id,
        propertyId: reservation.propertyId,
        propertyUnitId: reservation.propertyUnitId,
        userId: reservation.userId,
        totalValue: decimalToNumber(reservation.reservationFee),
      });
    }

    return updatedReservation;
  });

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId ?? undefined,
    action: "UPDATE",
    entityType: "Reservation",
    entityId: reservationId,
    summary: `Updated reservation ${reservationId} to ${input.status}`,
    payload: {
      previousStatus: reservation.status,
      nextStatus: input.status,
      notes: input.notes,
    } as Prisma.InputJsonValue,
  });

  await prisma.notification.create({
    data: {
      companyId: context.companyId,
      userId: result.userId,
      type: "MILESTONE_UPDATED",
      channel: "IN_APP",
      title: "Reservation updated",
      body: `Your reservation is now ${input.status.toLowerCase().replaceAll("_", " ")}.`,
      metadata: {
        reservationId,
      } as Prisma.InputJsonValue,
    },
  });

  return result;
}

export async function updateTransactionStageForAdmin(
  context: TenantContext,
  transactionId: string,
  input: AdminTransactionStageInput,
) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return {
      id: transactionId,
      currentStage: input.stage,
    };
  }

  const transaction = await ensureTransactionForAdmin(context, transactionId);
  if (!transaction) {
    throw new Error("Transaction not found.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.transaction.update({
      where: {
        id: transactionId,
      },
      data: {
        currentStage: input.stage,
      },
      select: {
        id: true,
        currentStage: true,
        userId: true,
      },
    });

    await syncTransactionMilestones(tx, {
      companyId: context.companyId!,
      transactionId,
      currentStage: input.stage,
    });

    return next;
  });

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId ?? undefined,
    action: "UPDATE",
    entityType: "Transaction",
    entityId: transactionId,
    summary: `Updated transaction ${transactionId} to ${input.stage}`,
    payload: {
      previousStage: transaction.currentStage,
      nextStage: input.stage,
      notes: input.notes,
    } as Prisma.InputJsonValue,
  });

  await prisma.notification.create({
    data: {
      companyId: context.companyId,
      userId: updated.userId,
      type: "MILESTONE_UPDATED",
      channel: "IN_APP",
      title: "Transaction milestone updated",
      body: `Your transaction is now at ${input.stage.toLowerCase().replaceAll("_", " ")}.`,
      metadata: {
        transactionId,
      } as Prisma.InputJsonValue,
    },
  });

  await publishDomainEvent("milestone/updated", {
    companyId: context.companyId,
    transactionId,
    stage: input.stage,
  });

  return updated;
}
