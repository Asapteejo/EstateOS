/**
 * Marketer commission rule management.
 *
 * Rules define how much a marketer earns when a payment on their attributed
 * transaction is confirmed. Lookup priority (most specific wins):
 *   1. Property-specific rule  (propertyId set, propertyType null)
 *   2. Property-type rule      (propertyId null, propertyType set)
 *   3. Company-wide rule       (both null)
 *
 * feeType FLAT    → marketer earns flatAmount per confirmed payment
 * feeType PERCENTAGE → marketer earns percentageRate % of payment amount
 */

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";

// ─── Delegate pattern (same as marketerRankingSnapshot in performance.ts) ───
// Prisma client is not yet regenerated — access new models via typed cast.

type RuleRecord = {
  id: string;
  companyId: string;
  name: string;
  feeType: "FLAT" | "PERCENTAGE";
  flatAmount: { toNumber: () => number } | number | null;
  percentageRate: { toNumber: () => number } | number | null;
  currency: string;
  propertyType: string | null;
  propertyId: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
};

type RuleDelegate = {
  findMany: (args?: unknown) => Promise<unknown>;
  findFirst: (args?: unknown) => Promise<unknown>;
  create: (args?: unknown) => Promise<unknown>;
  update: (args?: unknown) => Promise<unknown>;
};

function getRuleDelegate(): RuleDelegate | null {
  return (
    (prisma as typeof prisma & { marketerCommissionRule?: RuleDelegate })
      .marketerCommissionRule ?? null
  );
}

function toNumber(v: { toNumber: () => number } | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : v.toNumber();
}

// ─── Public types ─────────────────────────────────────────────────────────

export type CommissionRuleRow = {
  id: string;
  name: string;
  feeType: "FLAT" | "PERCENTAGE";
  flatAmount: number | null;
  percentageRate: number | null;
  currency: string;
  propertyType: string | null;
  propertyId: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
};

export type ApplicableRule = {
  id: string;
  feeType: "FLAT" | "PERCENTAGE";
  flatAmount: number | null;
  percentageRate: number | null;
  currency: string;
};

// ─── Rule lookup ──────────────────────────────────────────────────────────

/**
 * Returns the highest-priority active rule for a given payment context.
 * Returns null if no rule is configured or the database is unavailable.
 */
export async function getApplicableCommissionRule(input: {
  companyId: string;
  propertyId?: string | null;
  propertyType?: string | null;
}): Promise<ApplicableRule | null> {
  if (!featureFlags.hasDatabase) return null;

  const delegate = getRuleDelegate();
  if (!delegate) return null;

  const candidates = (await delegate.findMany({
    where: {
      companyId: input.companyId,
      isActive: true,
      OR: [
        // Exact property match
        ...(input.propertyId ? [{ propertyId: input.propertyId }] : []),
        // Property-type match
        ...(input.propertyType ? [{ propertyType: input.propertyType, propertyId: null }] : []),
        // Company-wide fallback
        { propertyId: null, propertyType: null },
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      feeType: true,
      flatAmount: true,
      percentageRate: true,
      currency: true,
      propertyType: true,
      propertyId: true,
    },
  })) as Array<Pick<RuleRecord, "id" | "feeType" | "flatAmount" | "percentageRate" | "currency" | "propertyType" | "propertyId">>;

  if (candidates.length === 0) return null;

  // Pick most specific: property-specific > type-specific > global
  const specific = input.propertyId ? candidates.find((r) => r.propertyId === input.propertyId) : null;
  const byType = input.propertyType ? candidates.find((r) => r.propertyType === input.propertyType && !r.propertyId) : null;
  const global = candidates.find((r) => !r.propertyId && !r.propertyType);
  const best = specific ?? byType ?? global ?? null;

  if (!best) return null;

  return {
    id: best.id,
    feeType: best.feeType,
    flatAmount: best.flatAmount != null ? toNumber(best.flatAmount) : null,
    percentageRate: best.percentageRate != null ? toNumber(best.percentageRate) : null,
    currency: best.currency,
  };
}

// ─── Admin CRUD ───────────────────────────────────────────────────────────

export async function listCommissionRules(companyId: string): Promise<CommissionRuleRow[]> {
  if (!featureFlags.hasDatabase) return [];

  const delegate = getRuleDelegate();
  if (!delegate) return [];

  const rows = (await delegate.findMany({
    where: { companyId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      feeType: true,
      flatAmount: true,
      percentageRate: true,
      currency: true,
      propertyType: true,
      propertyId: true,
      isActive: true,
      sortOrder: true,
      createdAt: true,
    },
  })) as RuleRecord[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    feeType: r.feeType,
    flatAmount: r.flatAmount != null ? toNumber(r.flatAmount) : null,
    percentageRate: r.percentageRate != null ? toNumber(r.percentageRate) : null,
    currency: r.currency,
    propertyType: r.propertyType,
    propertyId: r.propertyId,
    isActive: r.isActive,
    sortOrder: r.sortOrder,
    createdAt: r.createdAt,
  }));
}

export async function createCommissionRule(input: {
  companyId: string;
  name: string;
  feeType: "FLAT" | "PERCENTAGE";
  flatAmount?: number | null;
  percentageRate?: number | null;
  currency?: string;
  propertyType?: string | null;
  propertyId?: string | null;
}): Promise<{ id: string }> {
  const delegate = getRuleDelegate();
  if (!delegate) throw new Error("Commission rules not available");

  return (await delegate.create({
    data: {
      companyId: input.companyId,
      name: input.name,
      feeType: input.feeType,
      flatAmount: input.flatAmount ?? null,
      percentageRate: input.percentageRate ?? null,
      currency: input.currency ?? "NGN",
      propertyType: input.propertyType ?? null,
      propertyId: input.propertyId ?? null,
    },
    select: { id: true },
  })) as { id: string };
}

export async function deactivateCommissionRule(id: string, companyId: string): Promise<void> {
  const delegate = getRuleDelegate();
  if (!delegate) return;

  await delegate.update({
    where: { id },
    data: { isActive: false },
  });

  void companyId; // used by caller to verify ownership before calling
}
