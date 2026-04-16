/**
 * Deal risk scoring engine.
 *
 * Six weighted signals are evaluated for every active transaction each hour.
 * The raw point total is clamped to 100. A deal is flagged AT_RISK when its
 * score reaches 50 or above. The first time a deal crosses that threshold the
 * admin operators receive an in-app notification.
 *
 * Signal weights (max raw = 135 pts, clamped to 100):
 *   +30  Buyer portal inactive 14+ days (no notification read in 14 d)
 *   +25  KYC stalled in SUBMITTED state for 7+ days
 *   +20  Inspection no-show on record for this buyer
 *   +25  2+ failed payment attempts
 *   +15  No follow-up logged in 10+ days
 *   +20  Deal stage unchanged (transaction not touched) for 14+ days
 */

import { Prisma } from "@prisma/client";
import { subDays } from "date-fns";

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { createInAppNotification, getTenantOperatorRecipients } from "@/lib/notifications/service";

// ─── Pure scoring ─────────────────────────────────────────────────────────────

export type RiskSignal = {
  key: string;
  label: string;
  points: number;
};

export type RiskScoreResult = {
  score: number;         // 0-100
  isAtRisk: boolean;     // score >= 50
  signals: RiskSignal[];
};

export function computeRiskScore(input: {
  /** Proxy for buyer portal inactivity: true when no notification was read in 14+ days. */
  buyerPortalInactive: boolean;
  /** True when the buyer has a KYC submission in SUBMITTED state for 7+ days. */
  kycStalled: boolean;
  /** True when the buyer has a recorded inspection no-show. */
  hasInspectionNoShow: boolean;
  /** Number of FAILED payment records for this transaction. */
  failedPaymentCount: number;
  /** Timestamp of the last admin follow-up, or null if never followed up. */
  lastFollowedUpAt: Date | null;
  /** updatedAt of the Transaction row — proxy for last stage change. */
  transactionUpdatedAt: Date;
  /** Override "now" for testing. */
  now?: Date;
}): RiskScoreResult {
  const now = input.now ?? new Date();
  const signals: RiskSignal[] = [];

  if (input.buyerPortalInactive) {
    signals.push({ key: "portal_inactive", label: "Buyer portal inactive 14+ days", points: 30 });
  }

  if (input.kycStalled) {
    signals.push({ key: "kyc_stalled", label: "KYC stalled in review for 7+ days", points: 25 });
  }

  if (input.hasInspectionNoShow) {
    signals.push({ key: "inspection_no_show", label: "Inspection no-show recorded", points: 20 });
  }

  if (input.failedPaymentCount >= 2) {
    signals.push({ key: "failed_payments", label: "2+ failed payment attempts", points: 25 });
  }

  const tenDaysAgo = subDays(now, 10);
  const noFollowUp =
    input.lastFollowedUpAt === null || input.lastFollowedUpAt < tenDaysAgo;
  if (noFollowUp) {
    signals.push({ key: "no_follow_up", label: "No follow-up logged in 10+ days", points: 15 });
  }

  const fourteenDaysAgo = subDays(now, 14);
  if (input.transactionUpdatedAt < fourteenDaysAgo) {
    signals.push({ key: "stage_unchanged", label: "Deal stage unchanged for 14+ days", points: 20 });
  }

  const raw = signals.reduce((sum, s) => sum + s.points, 0);
  const score = Math.min(raw, 100);

  return { score, isAtRisk: score >= 50, signals };
}

// ─── Sweep ────────────────────────────────────────────────────────────────────

export type DealRiskSweepResult = {
  scored: number;
  atRiskCount: number;
  firstAlerts: number;
};

export async function runDealRiskSweep(input?: {
  companyId?: string;
  now?: Date;
}): Promise<DealRiskSweepResult> {
  if (!featureFlags.hasDatabase) {
    return { scored: 0, atRiskCount: 0, firstAlerts: 0 };
  }

  const now = input?.now ?? new Date();
  const fourteenDaysAgo = subDays(now, 14);
  const sevenDaysAgo = subDays(now, 7);

  // ── 1. Fetch active transactions ─────────────────────────────────────────
  // Cast as any: riskScore is a new schema field not yet in the generated types.
  type TxRow = {
    id: string;
    companyId: string;
    userId: string;
    riskScore: number;
    updatedAt: Date;
    lastFollowedUpAt: Date | null;
    reservation: { reference: string } | null;
    user: { firstName: string | null; lastName: string | null };
    payments: { id: string }[];
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transactions = (await (prisma.transaction.findMany as (args: any) => Promise<any[]>)({
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
      riskScore: true,
      updatedAt: true,
      lastFollowedUpAt: true,
      reservation: { select: { reference: true } },
      user: { select: { firstName: true, lastName: true } },
      payments: {
        where: { status: "FAILED" },
        select: { id: true },
      },
    },
  })) as TxRow[];

  if (transactions.length === 0) {
    return { scored: 0, atRiskCount: 0, firstAlerts: 0 };
  }

  const userIds = [...new Set(transactions.map((t) => t.userId))];

  // ── 2. Batch: users who read a notification in the last 14 days ──────────
  const recentlyActiveUserIds = new Set(
    (
      await prisma.notification.findMany({
        where: {
          userId: { in: userIds },
          readAt: { gte: fourteenDaysAgo },
        },
        select: { userId: true },
        distinct: ["userId"],
      })
    ).map((n) => n.userId),
  );

  // ── 3. Batch: users with stalled KYC (SUBMITTED > 7 days) ───────────────
  const stalledKycUserIds = new Set(
    (
      await prisma.kYCSubmission.findMany({
        where: {
          userId: { in: userIds },
          ...(input?.companyId ? { companyId: input.companyId } : {}),
          status: "SUBMITTED",
          updatedAt: { lte: sevenDaysAgo },
        },
        select: { userId: true },
        distinct: ["userId"],
      })
    ).map((k) => k.userId),
  );

  // ── 4. Batch: users with a NO_SHOW inspection ────────────────────────────
  const noShowUserIds = new Set(
    (
      await prisma.inspectionBooking.findMany({
        where: {
          userId: { in: userIds },
          ...(input?.companyId ? { companyId: input.companyId } : {}),
          status: "NO_SHOW",
        },
        select: { userId: true },
        distinct: ["userId"],
      })
    )
      .map((b) => b.userId)
      .filter((id): id is string => id !== null),
  );

  // ── 5. Score each transaction and persist changes ────────────────────────
  let atRiskCount = 0;
  let firstAlerts = 0;

  for (const tx of transactions) {
    const result = computeRiskScore({
      buyerPortalInactive: !recentlyActiveUserIds.has(tx.userId),
      kycStalled: stalledKycUserIds.has(tx.userId),
      hasInspectionNoShow: noShowUserIds.has(tx.userId),
      failedPaymentCount: tx.payments.length,
      lastFollowedUpAt: tx.lastFollowedUpAt,
      transactionUpdatedAt: tx.updatedAt,
      now,
    });

    if (result.isAtRisk) atRiskCount += 1;

    // Skip DB write if score hasn't changed
    if (result.score === tx.riskScore) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.transaction.update as (args: any) => Promise<any>)({
      where: { id: tx.id },
      data: { riskScore: result.score },
    });

    // First AT_RISK transition: notify operators
    const wasAtRisk = tx.riskScore >= 50;
    if (result.isAtRisk && !wasAtRisk) {
      firstAlerts += 1;
      const reservationRef =
        tx.reservation?.reference ?? tx.id.slice(0, 8);
      const buyerName =
        `${tx.user.firstName ?? ""} ${tx.user.lastName ?? ""}`.trim() || "Buyer";

      const operators = await getTenantOperatorRecipients(tx.companyId);
      for (const op of operators) {
        await createInAppNotification({
          companyId: tx.companyId,
          userId: op.id,
          type: "MILESTONE_UPDATED",
          title: "Deal flagged at risk",
          body: `${buyerName}'s deal (${reservationRef}) has been flagged AT_RISK with a risk score of ${result.score}.`,
          metadata: {
            transactionId: tx.id,
            riskScore: result.score,
            href: "/admin",
          } as Prisma.InputJsonValue,
        });
      }
    }
  }

  return { scored: transactions.length, atRiskCount, firstAlerts };
}
