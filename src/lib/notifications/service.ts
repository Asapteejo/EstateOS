import type { AppRole, NotificationChannel, NotificationType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/notifications/email";

type NotificationRecordInput = {
  companyId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Prisma.InputJsonValue;
  channel?: NotificationChannel;
};

export function buildNotificationRecipientLabel(input: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}) {
  const name = `${input.firstName ?? ""} ${input.lastName ?? ""}`.trim();
  return name || input.email || "User";
}

export async function createInAppNotification(input: NotificationRecordInput) {
  if (!featureFlags.hasDatabase) {
    return { id: `demo-notification-${input.type.toLowerCase()}` };
  }

  return prisma.notification.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      type: input.type,
      channel: input.channel ?? "IN_APP",
      title: input.title,
      body: input.body,
      metadata: input.metadata,
    },
  });
}

export async function notifyManyUsers(
  users: Array<{ id: string; email?: string | null; firstName?: string | null; lastName?: string | null }>,
  input: Omit<NotificationRecordInput, "userId"> & {
    emailSubject?: string;
    emailHtml?: (recipientName: string) => string;
  },
) {
  await Promise.all(
    users.map(async (user) => {
      await createInAppNotification({
        ...input,
        userId: user.id,
      });

      if (input.emailSubject && input.emailHtml && user.email) {
        await sendTransactionalEmail({
          to: user.email,
          subject: input.emailSubject,
          html: input.emailHtml(buildNotificationRecipientLabel(user)),
        });
      }
    }),
  );
}

export async function getTenantOperatorRecipients(companyId: string) {
  if (!featureFlags.hasDatabase) {
    return [];
  }

  return prisma.user.findMany({
    where: {
      companyId,
      isActive: true,
      roles: {
        some: {
          role: {
            name: {
              in: ["ADMIN", "STAFF", "FINANCE", "LEGAL"] satisfies AppRole[],
            },
          },
        },
      },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });
}
