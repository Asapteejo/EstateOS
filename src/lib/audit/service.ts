import type { AuditAction, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { logWarn } from "@/lib/ops/logger";

type AuditPayload = {
  companyId?: string | null;
  actorUserId?: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  summary: string;
  payload?: Prisma.InputJsonValue;
};

export function resolveAuditActorForWrite(input: {
  requestedActorUserId?: string;
  resolvedActorUserId?: string | null;
  isProduction: boolean;
}) {
  if (!input.requestedActorUserId) {
    return undefined;
  }

  if (input.resolvedActorUserId) {
    return input.resolvedActorUserId;
  }

  if (input.isProduction) {
    throw new Error("Audit actor user does not exist.");
  }

  return undefined;
}

async function findAuditActorUserId(actorUserId: string) {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ id: actorUserId }, { clerkUserId: actorUserId }],
    },
    select: { id: true },
  });

  return user?.id ?? null;
}

export async function writeAuditLog(entry: AuditPayload) {
  if (!featureFlags.hasDatabase) {
    return entry;
  }

  const resolvedActorUserId = entry.actorUserId
    ? await findAuditActorUserId(entry.actorUserId)
    : null;
  const actorUserId = resolveAuditActorForWrite({
    requestedActorUserId: entry.actorUserId,
    resolvedActorUserId,
    isProduction: featureFlags.isProduction,
  });

  if (entry.actorUserId && !actorUserId) {
    logWarn("Audit log actor user was not found; writing audit log as system action.", {
      actorUserId: entry.actorUserId,
      entityType: entry.entityType,
      entityId: entry.entityId,
    });
  }

  return prisma.auditLog.create({
    data: {
      actorUserId,
      companyId: entry.companyId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      summary: entry.summary,
      payload: entry.payload,
    },
  });
}
