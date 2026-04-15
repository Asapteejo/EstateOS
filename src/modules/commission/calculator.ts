/**
 * Marketer commission calculator and recorder.
 *
 * calculateCommissionAmount() is a pure function — no I/O.
 * recordMarketerCommission() persists one MarketerCommission row per payment.
 * getMarketerCommissionTotals() returns a Map used by the performance dashboard.
 */

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import type { ApplicableRule } from "./rules";

// ─── Delegate pattern ─────────────────────────────────────────────────────

type CommissionRow = {
  id: string;
  companyId: string;
  marketerId: string;
  paymentId: string;
  transactionId: string | null;
  ruleId: string | null;
  amount: { toNumber: () => number } | number;
  currency: string;
  status: string;
  createdAt: Date;
};

type CommissionDelegate = {
  create: (args?: unknown) => Promise<unknown>;
  findMany: (args?: unknown) => Promise<unknown>;
  aggregate: (args?: unknown) => Promise<unknown>;
};

function getCommissionDelegate(): CommissionDelegate | null {
  return (
    (prisma as typeof prisma & { marketerCommission?: CommissionDelegate })
      .marketerCommission ?? null
  );
}

// ─── Calculation ──────────────────────────────────────────────────────────

/**
 * Pure function — returns the commission amount in the same currency as the rule.
 * FLAT: fixed amount regardless of payment size.
 * PERCENTAGE: percentage of the payment amount, rounded to 2dp.
 */
export function calculateCommissionAmount(
  paymentAmount: number,
  rule: ApplicableRule,
): number {
  if (rule.feeType === "FLAT") {
    return rule.flatAmount ?? 0;
  }

  if (rule.feeType === "PERCENTAGE" && rule.percentageRate != null) {
    return Math.round(paymentAmount * (rule.percentageRate / 100) * 100) / 100;
  }

  return 0;
}

// ─── Recording ────────────────────────────────────────────────────────────

export async function recordMarketerCommission(input: {
  companyId: string;
  marketerId: string;
  paymentId: string;
  transactionId?: string | null;
  ruleId?: string | null;
  amount: number;
  currency: string;
}): Promise<void> {
  if (!featureFlags.hasDatabase) return;

  const delegate = getCommissionDelegate();
  if (!delegate) return;

  // @unique on paymentId — ignore duplicate (idempotent webhook re-delivery)
  try {
    await delegate.create({
      data: {
        companyId: input.companyId,
        marketerId: input.marketerId,
        paymentId: input.paymentId,
        transactionId: input.transactionId ?? null,
        ruleId: input.ruleId ?? null,
        amount: input.amount,
        currency: input.currency,
        status: "PENDING",
      },
    });
  } catch (err: unknown) {
    // P2002 = unique constraint violation — commission already recorded for this payment
    if (
      err instanceof Error &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return;
    }
    throw err;
  }
}

// ─── Totals for dashboard ─────────────────────────────────────────────────

export type MarketerCommissionTotals = {
  pending: number;
  paid: number;
  lifetime: number;
};

/**
 * Returns commission totals keyed by marketerId for a company.
 * Used by the admin marketer performance dashboard.
 */
export async function getMarketerCommissionTotals(
  companyId: string,
): Promise<Map<string, MarketerCommissionTotals>> {
  if (!featureFlags.hasDatabase) return new Map();

  const delegate = getCommissionDelegate();
  if (!delegate) return new Map();

  const rows = (await delegate.findMany({
    where: { companyId },
    select: {
      marketerId: true,
      amount: true,
      status: true,
    },
  })) as Array<{ marketerId: string; amount: { toNumber: () => number } | number; status: string }>;

  const result = new Map<string, MarketerCommissionTotals>();

  for (const row of rows) {
    const amount =
      typeof row.amount === "number" ? row.amount : row.amount.toNumber();
    const existing = result.get(row.marketerId) ?? { pending: 0, paid: 0, lifetime: 0 };

    existing.lifetime += amount;
    if (row.status === "PENDING") existing.pending += amount;
    if (row.status === "PAID") existing.paid += amount;

    result.set(row.marketerId, existing);
  }

  return result;
}
