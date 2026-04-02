import { Prisma } from "@prisma/client";
import { addHours, subDays, subMinutes } from "date-fns";

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { createInAppNotification, getTenantOperatorRecipients, notifyManyUsers } from "@/lib/notifications/service";
import { formatCurrency, formatDate } from "@/lib/utils";
import { syncPaymentRequestStatuses } from "@/modules/payment-requests/service";
import { syncPropertyVerificationStates } from "@/modules/properties/verification";
import { syncTransactionPaymentState } from "@/modules/transactions/mutations";
import { runWishlistReminderSweep } from "@/modules/wishlist/service";

type Decimalish = { toNumber?: () => number } | number | null | undefined;

function decimalToNumber(value: Decimalish) {
  if (value == null) {
    return 0;
  }

  return typeof value === "number" ? value : value.toNumber?.() ?? Number(value);
}

export function isInspectionReminderDue(input: {
  scheduledFor: Date;
  reminderSentAt?: Date | null;
  status: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  if (input.reminderSentAt || !["CONFIRMED", "RESCHEDULED"].includes(input.status)) {
    return false;
  }

  return input.scheduledFor >= now && input.scheduledFor <= addHours(now, 24);
}

export function isPaymentReminderDue(input: {
  nextPaymentDueAt?: Date | null;
  lastPaymentReminderAt?: Date | null;
  paymentStatus: string;
  outstandingBalance: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  if (input.outstandingBalance <= 0 || input.paymentStatus === "COMPLETED" || !input.nextPaymentDueAt) {
    return false;
  }

  if (input.lastPaymentReminderAt && input.lastPaymentReminderAt >= subDays(now, 2)) {
    return false;
  }

  return input.nextPaymentDueAt <= now;
}

export async function runOperationalAutomationSweep(input?: { companyId?: string }) {
  const now = new Date();

  if (!featureFlags.hasDatabase) {
    return {
      wishlistReminders: 0,
      overduePayments: 0,
      inspectionReminders: 0,
      followUpAlerts: 0,
    };
  }

  const wishlistResult = await runWishlistReminderSweep(now);

  const transactions = await prisma.transaction.findMany({
    where: {
      ...(input?.companyId ? { companyId: input.companyId } : {}),
      currentStage: {
        notIn: ["FINAL_PAYMENT_COMPLETED", "HANDOVER_COMPLETED"],
      },
    },
    select: {
      id: true,
      companyId: true,
      userId: true,
      paymentStatus: true,
      nextPaymentDueAt: true,
      lastPaymentReminderAt: true,
      outstandingBalance: true,
      reservation: {
        select: {
          reference: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  let overduePayments = 0;

  for (const transaction of transactions) {
    const updated = await prisma.$transaction((tx) =>
      syncTransactionPaymentState(tx, {
        companyId: transaction.companyId,
        transactionId: transaction.id,
        now,
      }),
    );

    const outstandingBalance = decimalToNumber(transaction.outstandingBalance);
    const paymentStatus = updated?.paymentStatus ?? transaction.paymentStatus;

    if (
      !isPaymentReminderDue({
        nextPaymentDueAt: updated?.nextPaymentDueAt ?? transaction.nextPaymentDueAt,
        lastPaymentReminderAt: transaction.lastPaymentReminderAt,
        paymentStatus,
        outstandingBalance,
        now,
      })
    ) {
      continue;
    }

    overduePayments += 1;
    const operators = await getTenantOperatorRecipients(transaction.companyId);

    await notifyManyUsers(operators, {
      companyId: transaction.companyId,
      type: "INSTALLMENT_DUE",
      title: "Payment overdue",
      body: `${transaction.reservation?.reference ?? "A deal"} is overdue with ${formatCurrency(outstandingBalance)} outstanding.`,
      metadata: {
        transactionId: transaction.id,
        href: "/admin/payments",
      } as Prisma.InputJsonValue,
    });

    if (transaction.user.email) {
      await sendTransactionalEmail({
        to: transaction.user.email,
        subject: "Your EstateOS payment is overdue",
        html: `<p>Hi ${transaction.user.firstName ?? "there"},</p><p>Your payment for ${
          transaction.reservation?.reference ?? "your reservation"
        } is overdue. Outstanding balance: <strong>${formatCurrency(outstandingBalance)}</strong>.</p>`,
      });
    }

    await prisma.transaction.update({
      where: {
        id: transaction.id,
      },
      data: {
        paymentStatus: "OVERDUE",
        lastPaymentReminderAt: now,
      },
    });
  }

  const inspectionBookings = await prisma.inspectionBooking.findMany({
    where: {
      ...(input?.companyId ? { companyId: input.companyId } : {}),
      scheduledFor: {
        gte: now,
        lte: addHours(now, 24),
      },
    },
    select: {
      id: true,
      companyId: true,
      status: true,
      reminderSentAt: true,
      scheduledFor: true,
      email: true,
      fullName: true,
      userId: true,
      property: {
        select: {
          title: true,
        },
      },
    },
  });

  let inspectionReminders = 0;

  for (const booking of inspectionBookings) {
    if (
      !isInspectionReminderDue({
        scheduledFor: booking.scheduledFor,
        reminderSentAt: booking.reminderSentAt,
        status: booking.status,
        now,
      })
    ) {
      continue;
    }

    inspectionReminders += 1;

    await sendTransactionalEmail({
      to: booking.email,
      subject: "Inspection reminder",
      html: `<p>Hi ${booking.fullName},</p><p>This is a reminder for your inspection at <strong>${booking.property.title}</strong> on ${formatDate(booking.scheduledFor, "PPP p")}.</p>`,
    });

    if (booking.userId) {
      await createInAppNotification({
        companyId: booking.companyId,
        userId: booking.userId,
        type: "INSPECTION_UPDATED",
        title: "Inspection reminder",
        body: `Your inspection for ${booking.property.title} is coming up on ${formatDate(booking.scheduledFor, "PPP p")}.`,
        metadata: {
          inspectionId: booking.id,
        } as Prisma.InputJsonValue,
      });
    }

    await prisma.inspectionBooking.update({
      where: {
        id: booking.id,
      },
      data: {
        reminderSentAt: now,
      },
    });
  }

  const followUpCandidates = await prisma.savedProperty.findMany({
    where: {
      ...(input?.companyId ? { companyId: input.companyId } : {}),
      status: "ACTIVE",
      followUpStatus: {
        in: ["NONE", "PENDING_CALL"],
      },
      createdAt: {
        lte: subDays(now, 3),
      },
    },
    select: {
      id: true,
      companyId: true,
      userId: true,
      property: {
        select: {
          title: true,
        },
      },
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    take: 20,
  });

  const groupedCompanyIds = [...new Set(followUpCandidates.map((item) => item.companyId))];
  let followUpAlerts = 0;

  for (const companyId of groupedCompanyIds) {
    const operators = await getTenantOperatorRecipients(companyId);
    const companyItems = followUpCandidates.filter((item) => item.companyId === companyId);
    if (companyItems.length === 0) {
      continue;
    }

    followUpAlerts += companyItems.length;

    await notifyManyUsers(operators, {
      companyId,
      type: "SYSTEM",
      title: "Clients need follow-up",
      body: `${companyItems.length} client${companyItems.length === 1 ? "" : "s"} need attention today.`,
      metadata: {
        href: "/admin/clients",
        clientIds: companyItems.map((item) => item.userId),
      } as Prisma.InputJsonValue,
    });
  }

  return {
    wishlistReminders: wishlistResult.delivered,
    overduePayments,
    inspectionReminders,
    followUpAlerts,
  };
}

export async function runScheduledOperationalJobs(input?: {
  companyId?: string;
  source?: "manual" | "cron" | "inngest";
  eventKey?: string | null;
  now?: Date;
}) {
  const now = input?.now ?? new Date();
  const source = input?.source ?? "manual";

  if (!featureFlags.hasDatabase) {
    return {
      duplicate: false,
      source,
      automation: {
        wishlistReminders: 0,
        overduePayments: 0,
        inspectionReminders: 0,
        followUpAlerts: 0,
      },
      verification: { updated: 0, hidden: 0, warned: 0 },
      paymentRequests: { expired: 0 },
    };
  }

  const recentRun = await prisma.backgroundJobLog.findFirst({
    where: {
      companyId: input?.companyId ?? null,
      jobName: "operational-sweep",
      status: "SUCCESS",
      createdAt: {
        gte: subMinutes(now, 15),
      },
      ...(input?.eventKey ? { eventKey: input.eventKey } : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (input?.eventKey && recentRun) {
    return {
      duplicate: true,
      source,
      automation: {
        wishlistReminders: 0,
        overduePayments: 0,
        inspectionReminders: 0,
        followUpAlerts: 0,
      },
      verification: { updated: 0, hidden: 0, warned: 0 },
      paymentRequests: { expired: 0 },
    };
  }

  const started = await prisma.backgroundJobLog.create({
    data: {
      companyId: input?.companyId ?? null,
      jobName: "operational-sweep",
      eventKey: input?.eventKey ?? null,
      status: "RUNNING",
      payload: {
        source,
        startedAt: now.toISOString(),
      } as Prisma.InputJsonValue,
    },
  });

  try {
    const [automation, verification, paymentRequests] = await Promise.all([
      runOperationalAutomationSweep({ companyId: input?.companyId }),
      syncPropertyVerificationStates({ companyId: input?.companyId, now }),
      syncPaymentRequestStatuses(prisma, { companyId: input?.companyId, now }),
    ]);

    await prisma.backgroundJobLog.update({
      where: { id: started.id },
      data: {
        status: "SUCCESS",
        payload: {
          source,
          automation,
          verification,
          paymentRequests,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      duplicate: false,
      source,
      automation,
      verification,
      paymentRequests,
    };
  } catch (error) {
    await prisma.backgroundJobLog.update({
      where: { id: started.id },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message : "Unknown automation failure",
      },
    });
    throw error;
  }
}
