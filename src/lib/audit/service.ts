import type { AuditAction, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";

type AuditPayload = {
  companyId?: string | null;
  actorUserId?: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  summary: string;
  payload?: Prisma.InputJsonValue;
};

export async function writeAuditLog(entry: AuditPayload) {
  if (!featureFlags.hasDatabase) {
    return entry;
  }

  return prisma.auditLog.create({
    data: {
      actorUserId: entry.actorUserId,
      companyId: entry.companyId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      summary: entry.summary,
      payload: entry.payload,
    },
  });
}
