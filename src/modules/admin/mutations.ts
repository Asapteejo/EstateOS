import type { TenantContext } from "@/lib/tenancy/context";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { findFirstForTenant } from "@/lib/tenancy/db";

type ScopedFindFirstDelegate = { findFirst: (args?: unknown) => Promise<unknown> };

export async function markAdminNotificationAsRead(
  context: TenantContext,
  notificationId: string,
) {
  if (!context.companyId) {
    throw new Error("Tenant context is required.");
  }

  if (!featureFlags.hasDatabase) {
    return {
      id: notificationId,
      readAt: new Date().toISOString(),
    };
  }

  const notification = (await findFirstForTenant(
    prisma.notification as ScopedFindFirstDelegate,
    context,
    {
      where: {
        id: notificationId,
      },
      select: {
        id: true,
      },
    } as Parameters<typeof prisma.notification.findFirst>[0],
  )) as { id: string } | null;

  if (!notification) {
    throw new Error("Notification not found.");
  }

  return prisma.notification.update({
    where: {
      id: notification.id,
    },
    data: {
      readAt: new Date(),
    },
    select: {
      id: true,
      readAt: true,
    },
  });
}

export async function markAllAdminNotificationsAsRead(context: TenantContext) {
  if (!context.companyId) {
    throw new Error("Tenant context is required.");
  }

  if (!featureFlags.hasDatabase) {
    return {
      count: 0,
    };
  }

  const result = await prisma.notification.updateMany({
    where: {
      companyId: context.companyId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  return {
    count: result.count,
  };
}
