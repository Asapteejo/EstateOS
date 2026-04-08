import { Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { publishRealtimeEvent } from "@/lib/realtime/events";
import type { TenantContext } from "@/lib/tenancy/context";
import { PRODUCT_EVENT_NAMES, trackProductEvent } from "@/modules/analytics/activity";

export async function updateCompanyLifecycleStatus(
  context: TenantContext,
  companyId: string,
  input: {
    status: "ACTIVE" | "SUSPENDED" | "DISABLED";
    reason?: string | null;
  },
) {
  if (!featureFlags.hasDatabase) {
    return {
      id: companyId,
      status: input.status,
      suspendedAt: input.status === "SUSPENDED" ? new Date() : null,
      suspensionReason: input.reason ?? null,
    };
  }

  if (!context.isSuperAdmin) {
    throw new Error("Superadmin access is required.");
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      status: true,
    },
  });

  if (!company) {
    throw new Error("Company not found.");
  }

  const updated = await prisma.company.update({
    where: { id: companyId },
    data: {
      status: input.status,
      suspendedAt: input.status === "SUSPENDED" ? new Date() : null,
      suspensionReason: input.status === "SUSPENDED" ? input.reason ?? null : null,
    },
    select: {
      id: true,
      name: true,
      status: true,
      suspendedAt: true,
      suspensionReason: true,
    },
  });

  await writeAuditLog({
    companyId,
    actorUserId: context.userId ?? undefined,
    action: "UPDATE",
    entityType: "Company",
    entityId: companyId,
    summary: `${input.status === "ACTIVE" ? "Reactivated" : input.status === "SUSPENDED" ? "Suspended" : "Disabled"} ${updated.name}`,
    payload: {
      previousStatus: company.status,
      nextStatus: updated.status,
      reason: input.reason ?? null,
    } as Prisma.InputJsonValue,
  });

  await trackProductEvent({
    companyId,
    userId: context.userId ?? undefined,
    eventName:
      input.status === "SUSPENDED"
        ? PRODUCT_EVENT_NAMES.companySuspended
        : PRODUCT_EVENT_NAMES.companyReactivated,
    summary:
      input.status === "SUSPENDED"
        ? `${updated.name} was suspended`
        : `${updated.name} was reactivated`,
    payload: {
      previousStatus: company.status,
      nextStatus: updated.status,
      reason: input.reason ?? null,
    } as Prisma.InputJsonValue,
  });

  publishRealtimeEvent({
    scope: "platform",
    companyId,
    name: "company.status.updated",
    summary:
      input.status === "SUSPENDED"
        ? `${updated.name} suspended`
        : input.status === "ACTIVE"
          ? `${updated.name} reactivated`
          : `${updated.name} disabled`,
    metadata: {
      previousStatus: company.status,
      nextStatus: updated.status,
      reason: input.reason ?? null,
    },
  });

  publishRealtimeEvent({
    scope: "company",
    companyId,
    name: "company.status.updated",
    summary:
      input.status === "SUSPENDED"
        ? `${updated.name} suspended`
        : input.status === "ACTIVE"
          ? `${updated.name} reactivated`
          : `${updated.name} disabled`,
    metadata: {
      previousStatus: company.status,
      nextStatus: updated.status,
      reason: input.reason ?? null,
    },
  });

  return updated;
}
