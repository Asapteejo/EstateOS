/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Revenue recovery engine.
 *
 * Escalation ladder for overdue transactions:
 *   Stage 0 → no action yet
 *   Stage 1 → day 1: buyer reminder email + operator in-app notification
 *   Stage 2 → day 3: urgent buyer email + operator in-app notification
 *   Stage 3 → day 7: buyer email + marketer escalation email with WhatsApp link
 *   Stage 4 → day 14: buyer email + ADMIN user flag emails and in-app notifications
 *
 * Idempotent: each transaction advances at most one stage per sweep.
 * The `overdueReminderStage` field on Transaction acts as a high-water mark
 * so resends are never triggered by repeated sweeps at the same threshold.
 */

import { AppRole, Prisma } from "@prisma/client";
import { differenceInDays } from "date-fns";

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import {
  renderMarketerEscalationEmail,
  renderOverdueBuyerEmail,
  renderOwnerEscalationEmail,
} from "@/lib/notifications/templates";
import {
  createInAppNotification,
  getTenantOperatorRecipients,
  notifyManyUsers,
} from "@/lib/notifications/service";
import { formatCurrency } from "@/lib/utils";
import { PRODUCT_EVENT_NAMES, trackProductEvent } from "@/modules/analytics/activity";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp";
import { buildWhatsAppHref } from "@/modules/team/contact";

// ─── Stage constants ────────────────────────────────────────────────────────

export const STAGE_NONE   = 0;
export const STAGE_DAY_1  = 1;
export const STAGE_DAY_3  = 2;
export const STAGE_DAY_7  = 3;
export const STAGE_DAY_14 = 4;

/** Returns the highest escalation stage the deal should have reached by now. */
export function getTargetStage(daysOverdue: number): number {
  if (daysOverdue >= 14) return STAGE_DAY_14;
  if (daysOverdue >= 7)  return STAGE_DAY_7;
  if (daysOverdue >= 3)  return STAGE_DAY_3;
  if (daysOverdue >= 1)  return STAGE_DAY_1;
  return STAGE_NONE;
}

// ─── Main sweep ─────────────────────────────────────────────────────────────

export async function runRevenueRecoverySweep(input?: {
  companyId?: string;
}): Promise<{ processed: number; escalated: number }> {
  if (!featureFlags.hasDatabase) {
    return { processed: 0, escalated: 0 };
  }

  const now = new Date();
  const portalBaseUrl = process.env.NEXT_PUBLIC_PORTAL_BASE_URL ?? "";

  // Fetch overdue transactions that haven't reached the final stage yet.
  // Cast as `any` because `overdueReminderStage` is a new schema field that
  // won't appear in the generated Prisma types until `prisma generate` is run.
  type TxRow = {
    id: string;
    companyId: string;
    userId: string;
    nextPaymentDueAt: Date | null;
    outstandingBalance: { toNumber?: () => number } | number;
    overdueReminderStage: number;
    reservation: { reference: string } | null;
    user: { id: string; email: string | null; firstName: string | null; phone: string | null };
    marketer: { id: string; fullName: string; email: string | null; whatsappNumber: string | null } | null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transactions = (await (prisma.transaction.findMany as (args: any) => Promise<any[]>)({
    where: {
      ...(input?.companyId ? { companyId: input.companyId } : {}),
      paymentStatus: "OVERDUE",
      overdueReminderStage: { lt: STAGE_DAY_14 },
      nextPaymentDueAt: { not: null },
    },
    select: {
      id: true,
      companyId: true,
      userId: true,
      nextPaymentDueAt: true,
      outstandingBalance: true,
      overdueReminderStage: true,
      reservation: { select: { reference: true } },
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          phone: true,
        },
      },
      marketer: {
        select: {
          id: true,
          fullName: true,
          email: true,
          whatsappNumber: true,
        },
      },
    },
  })) as TxRow[];

  if (transactions.length === 0) {
    return { processed: 0, escalated: 0 };
  }

  // Batch-fetch company names and ADMIN users to avoid N+1 inside the loop.
  const uniqueCompanyIds = [...new Set(transactions.map((t) => t.companyId))];

  const [companyRows, adminUsers] = await Promise.all([
    prisma.company.findMany({
      where: { id: { in: uniqueCompanyIds } },
      select: { id: true, name: true },
    }),
    // ADMIN users — same UserRole pattern used by getTenantOperatorRecipients
    prisma.user.findMany({
      where: {
        companyId: { in: uniqueCompanyIds },
        isActive: true,
        roles: {
          some: {
            role: { name: "ADMIN" satisfies AppRole },
          },
        },
      },
      select: {
        id: true,
        companyId: true,
        email: true,
        firstName: true,
      },
    }),
  ]);

  const companyNameById = Object.fromEntries(
    companyRows.map((c) => [c.id, c.name] as [string, string]),
  );
  const adminsByCompany = adminUsers.reduce<
    Record<string, Array<{ userId: string; email: string | null; firstName: string | null }>>
  >((acc, u) => {
    if (!u.companyId) return acc;
    if (!acc[u.companyId]) acc[u.companyId] = [];
    acc[u.companyId].push({ userId: u.id, email: u.email, firstName: u.firstName });
    return acc;
  }, {});

  let processed = 0;
  let escalated = 0;

  for (const tx of transactions) {
    if (!tx.nextPaymentDueAt) continue;

    const daysOverdue = differenceInDays(now, tx.nextPaymentDueAt);
    if (daysOverdue < 1) continue;

    const targetStage = getTargetStage(daysOverdue);
    if (targetStage <= tx.overdueReminderStage) continue; // already handled

    processed += 1;
    const companyName = companyNameById[tx.companyId] ?? "EstateOS";
    const reservationRef = tx.reservation?.reference ?? "your reservation";
    const outstandingBalance = formatCurrency(
      typeof tx.outstandingBalance === "number"
        ? tx.outstandingBalance
        : (tx.outstandingBalance as { toNumber?: () => number }).toNumber?.() ?? 0,
    );
    const portalUrl = `${portalBaseUrl}/portal/payments`;

    // ── Buyer email (all stages) ──────────────────────────────────────────
    if (tx.user.email) {
      const { subject, html } = renderOverdueBuyerEmail({
        buyerName: tx.user.firstName ?? "there",
        reservationRef,
        outstandingBalance,
        daysOverdue,
        portalUrl,
        companyName,
      });
      await sendTransactionalEmail({ to: tx.user.email, subject, html });
    }

    // ── WhatsApp buyer message (stages 1–3) ──────────────────────────────
    if (
      targetStage === STAGE_DAY_1 ||
      targetStage === STAGE_DAY_3 ||
      targetStage === STAGE_DAY_7
    ) {
      const stageMessages: Record<number, string> = {
        [STAGE_DAY_1]: `Hi ${tx.user.firstName ?? "there"}, your payment of ${outstandingBalance} for ${reservationRef} at ${companyName} is now due. Please log in to complete your payment: ${portalUrl}`,
        [STAGE_DAY_3]: `Hi ${tx.user.firstName ?? "there"}, your payment of ${outstandingBalance} for ${reservationRef} at ${companyName} is now 3 days overdue. To avoid further action, please pay now: ${portalUrl}`,
        [STAGE_DAY_7]: `Hi ${tx.user.firstName ?? "there"}, this is an urgent notice. Your payment of ${outstandingBalance} for ${reservationRef} at ${companyName} is 7 days overdue. Your assigned agent has been notified. Please resolve this immediately: ${portalUrl}`,
      };
      await sendWhatsAppMessage({
        to: tx.user.phone,
        body: stageMessages[targetStage] ?? stageMessages[STAGE_DAY_1],
      });
    }

    // ── Stage-specific escalations ────────────────────────────────────────
    if (targetStage === STAGE_DAY_1 || targetStage === STAGE_DAY_3) {
      // Operator in-app notification only — no extra email at these stages
      const operators = await getTenantOperatorRecipients(tx.companyId);
      await notifyManyUsers(operators, {
        companyId: tx.companyId,
        type: "INSTALLMENT_DUE",
        title: `Payment overdue ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}`,
        body: `${reservationRef} is overdue with ${outstandingBalance} outstanding.`,
        metadata: {
          transactionId: tx.id,
          href: "/admin/payments",
        } as Prisma.InputJsonValue,
      });
    }

    if (targetStage === STAGE_DAY_7) {
      // Escalate to the assigned marketer
      const marketer = tx.marketer;
      if (marketer?.email) {
        const whatsAppHref = tx.user.phone
          ? buildWhatsAppHref(tx.user.phone)
          : buildWhatsAppHref(marketer.whatsappNumber);

        const { subject, html } = renderMarketerEscalationEmail({
          marketerName: marketer.fullName.split(" ")[0] ?? "there",
          buyerName: tx.user.firstName ?? reservationRef,
          reservationRef,
          outstandingBalance,
          daysOverdue,
          whatsAppHref,
          companyName,
        });
        await sendTransactionalEmail({ to: marketer.email, subject, html });
      }
    }

    if (targetStage === STAGE_DAY_14) {
      // Flag to all ADMIN users for this company
      const admins = adminsByCompany[tx.companyId] ?? [];
      const marketerName = tx.marketer?.fullName ?? null;

      for (const admin of admins) {
        if (admin.email) {
          const { subject, html } = renderOwnerEscalationEmail({
            ownerName: admin.firstName ?? "there",
            buyerName: tx.user.firstName ?? reservationRef,
            reservationRef,
            outstandingBalance,
            daysOverdue,
            assignedMarketerName: marketerName,
            companyName,
          });
          await sendTransactionalEmail({ to: admin.email, subject, html });
        }

        await createInAppNotification({
          companyId: tx.companyId,
          userId: admin.userId,
          type: "INSTALLMENT_DUE",
          title: "Revenue at risk",
          body: `${reservationRef} is ${daysOverdue} days overdue with ${outstandingBalance} outstanding. Immediate attention required.`,
          metadata: { transactionId: tx.id, href: "/admin/payments" } as Prisma.InputJsonValue,
        });
      }
    }

    // ── Advance stage + track event ───────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.transaction.update({
      where: { id: tx.id },
      data: { overdueReminderStage: targetStage } as any, // new field — re-type after `prisma generate`
    });

    escalated += 1;

    await trackProductEvent({
      companyId: tx.companyId,
      userId: tx.userId,
      eventName: PRODUCT_EVENT_NAMES.overduePaymentDetected,
      summary: `Recovery stage ${targetStage} triggered for ${reservationRef} (${daysOverdue} days overdue)`,
      payload: {
        transactionId: tx.id,
        stage: targetStage,
        daysOverdue,
      } as Prisma.InputJsonValue,
    });
  }

  return { processed, escalated };
}
