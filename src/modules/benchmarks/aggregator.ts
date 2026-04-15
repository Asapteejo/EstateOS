/**
 * Benchmarking aggregator.
 *
 * Computes four key performance metrics for a single tenant company and
 * compares them against anonymised platform-wide distributions.
 *
 * Metrics:
 *   1. Inquiry → reservation conversion rate  (higher is better)
 *   2. Average deal velocity in days          (lower is better)
 *   3. Payment default rate                   (lower is better)
 *   4. Top-performing property types          (tenant breakdown + platform share)
 *
 * Platform distributions are computed by running the same aggregations
 * across ALL companies simultaneously, grouping by companyId, and deriving
 * per-company values before extracting quartiles. No individual company
 * identity is surfaced — only anonymised distribution statistics.
 *
 * Minimum thresholds prevent thin-data workspaces from skewing benchmarks:
 *   - Conversion rate:  company must have ≥ 5 inquiries in the window
 *   - Deal velocity:    company must have ≥ 1 completed transaction
 *   - Default rate:     company must have ≥ 3 transactions total
 */

import { subDays } from "date-fns";

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";

// ─── Constants ───────────────────────────────────────────────────────────────

export const BENCHMARK_WINDOW_DAYS = 90;

const COMPLETED_STAGES = [
  "FINAL_PAYMENT_COMPLETED",
  "HANDOVER_COMPLETED",
] as const;

const MIN_INQUIRIES_FOR_CONVERSION  = 5;
const MIN_TX_FOR_DEFAULT            = 3;

// ─── Types ───────────────────────────────────────────────────────────────────

/** A single comparable metric with both sides of the comparison. */
export type MetricBand = {
  /** Tenant's computed value. */
  tenantValue: number;
  /** 25th percentile across qualifying platform companies. */
  platformP25: number;
  /** Median (50th percentile) across qualifying platform companies. */
  platformMedian: number;
  /** 75th percentile across qualifying platform companies. */
  platformP75: number;
  /** Simple mean across qualifying platform companies. */
  platformAvg: number;
  /**
   * Tenant's percentile rank within the platform distribution (0–100).
   * For "lower is better" metrics this is already inverted so 100 = best.
   */
  tenantPercentileRank: number;
  /** Number of companies used to build the distribution. */
  sampleSize: number;
  /** Whether a smaller value is better (default rate, velocity). */
  isLowerBetter: boolean;
  /** Qualitative label for the tenant's position. */
  positionLabel: "top_quartile" | "above_median" | "near_median" | "below_median" | "low" | "insufficient_data";
};

/** Per-property-type breakdown for the tenant + platform share data. */
export type PropertyTypeBenchmark = {
  type: string;
  /** Tenant's number of active deals in this type. */
  tenantDealCount: number;
  /** Tenant's completed deals in this type. */
  tenantCompletedDeals: number;
  /** Tenant's total successful payment revenue in this type. */
  tenantRevenue: number;
  /** Tenant deal completion rate: completedDeals / dealCount (0–100). */
  tenantCompletionRate: number;
  /**
   * Percentage of ALL platform properties (across all companies) that are
   * this type. Gives context for how popular this category is.
   */
  platformTypeShare: number;
};

export type BenchmarkReport = {
  inquiryToReservation: MetricBand;
  dealVelocity: MetricBand;
  paymentDefaultRate: MetricBand;
  topPropertyTypes: PropertyTypeBenchmark[];
  windowDays: number;
  generatedAt: Date;
};

// ─── Stat helpers ─────────────────────────────────────────────────────────────

function pct(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function decimalToNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof (v as { toNumber?: () => number }).toNumber === "function") {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number(v) || 0;
}

/**
 * Computes how many values in `distribution` are strictly worse than `value`,
 * then returns that as a 0–100 rank. For lower-is-better metrics the comparison
 * is inverted so that a lower value still produces a higher rank.
 */
function percentileRank(value: number, distribution: number[], isLowerBetter: boolean): number {
  if (distribution.length === 0) return 50;
  const countBeaten = isLowerBetter
    ? distribution.filter((v) => v > value).length
    : distribution.filter((v) => v < value).length;
  return Math.round((countBeaten / distribution.length) * 100);
}

function positionLabel(rank: number, sampleSize: number): MetricBand["positionLabel"] {
  if (sampleSize < 3) return "insufficient_data";
  if (rank >= 75) return "top_quartile";
  if (rank >= 55) return "above_median";
  if (rank >= 40) return "near_median";
  if (rank >= 20) return "below_median";
  return "low";
}

function buildBand(
  tenantValue: number,
  distribution: number[],
  isLowerBetter: boolean,
): MetricBand {
  const rank = percentileRank(tenantValue, distribution, isLowerBetter);
  return {
    tenantValue,
    platformP25: pct(distribution, 25),
    platformMedian: pct(distribution, 50),
    platformP75: pct(distribution, 75),
    platformAvg: mean(distribution),
    tenantPercentileRank: rank,
    sampleSize: distribution.length,
    isLowerBetter,
    positionLabel: positionLabel(rank, distribution.length),
  };
}

// ─── Raw-row types (for Prisma delegate casts) ────────────────────────────────

type InquiryGroupRow    = { companyId: string; _count: { id: number } };
type ReservationGroupRow = { companyId: string; _count: { id: number } };
type TxStatusGroupRow  = { companyId: string; paymentStatus: string; _count: { id: number } };
type TxVelocityRow     = { companyId: string; createdAt: Date; updatedAt: Date };
type TxPropertyRow     = {
  companyId: string;
  currentStage: string;
  property: { propertyType: string } | null;
  payments: Array<{ amount: unknown }>;
};
type PropertyTypeGroupRow = { propertyType: string; _count: { id: number } };

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function getBenchmarkReport(companyId: string): Promise<BenchmarkReport | null> {
  if (!featureFlags.hasDatabase) return null;

  const windowStart = subDays(new Date(), BENCHMARK_WINDOW_DAYS);

  // Run all 10 queries in parallel — 5 tenant-scoped, 5 platform-wide.
  const [
    tenantInquiryCount,
    tenantReservationCount,
    tenantCompletedTx,
    tenantTxStatusGroups,
    tenantTxWithTypes,
    platformInquiryGroups,
    platformReservationGroups,
    platformTxStatusGroups,
    platformVelocityTx,
    platformPropertyTypeGroups,
  ] = await Promise.all([

    // ── Tenant: inquiry count in window ──────────────────────────────────────
    prisma.inquiry.count({
      where: { companyId, createdAt: { gte: windowStart } },
    }),

    // ── Tenant: reservation count in window ──────────────────────────────────
    prisma.reservation.count({
      where: { companyId, createdAt: { gte: windowStart } },
    }),

    // ── Tenant: completed transactions (for velocity) ─────────────────────────
    prisma.transaction.findMany({
      where: {
        companyId,
        currentStage: { in: [...COMPLETED_STAGES] },
      },
      select: { createdAt: true, updatedAt: true },
    }),

    // ── Tenant: transaction counts by payment status (for default rate) ───────
    prisma.transaction.groupBy({
      by: ["paymentStatus"],
      where: { companyId },
      _count: { id: true },
    }),

    // ── Tenant: transactions with property type + payments (for type analysis) ─
    prisma.transaction.findMany({
      where: { companyId },
      select: {
        currentStage: true,
        property: { select: { propertyType: true } },
        payments: {
          where: { status: "SUCCESS" },
          select: { amount: true },
        },
      },
    }),

    // ── Platform: inquiry counts grouped by company ───────────────────────────
    prisma.inquiry.groupBy({
      by: ["companyId"],
      where: { createdAt: { gte: windowStart } },
      _count: { id: true },
    }),

    // ── Platform: reservation counts grouped by company ───────────────────────
    prisma.reservation.groupBy({
      by: ["companyId"],
      where: { createdAt: { gte: windowStart } },
      _count: { id: true },
    }),

    // ── Platform: transaction counts by company + paymentStatus ───────────────
    prisma.transaction.groupBy({
      by: ["companyId", "paymentStatus"],
      _count: { id: true },
    }),

    // ── Platform: completed transactions for velocity ─────────────────────────
    prisma.transaction.findMany({
      where: { currentStage: { in: [...COMPLETED_STAGES] } },
      select: { companyId: true, createdAt: true, updatedAt: true },
    }),

    // ── Platform: property type distribution ──────────────────────────────────
    prisma.property.groupBy({
      by: ["propertyType"],
      where: { status: { not: "ARCHIVED" } },
      _count: { id: true },
    }),
  ]);

  // ─── 1. Inquiry → Reservation conversion ─────────────────────────────────

  const tenantConversionRate =
    tenantInquiryCount >= MIN_INQUIRIES_FOR_CONVERSION
      ? (tenantReservationCount / tenantInquiryCount) * 100
      : 0;

  const platformInquiryMap = new Map<string, number>(
    (platformInquiryGroups as InquiryGroupRow[]).map((r) => [r.companyId, r._count.id]),
  );
  const platformReservationMap = new Map<string, number>(
    (platformReservationGroups as ReservationGroupRow[]).map((r) => [
      r.companyId,
      r._count.id,
    ]),
  );

  const conversionDistribution: number[] = [];
  for (const [cid, inquiries] of platformInquiryMap) {
    if (inquiries < MIN_INQUIRIES_FOR_CONVERSION) continue;
    const reservations = platformReservationMap.get(cid) ?? 0;
    conversionDistribution.push((reservations / inquiries) * 100);
  }

  // ─── 2. Deal velocity (days from deal creation to completion) ─────────────

  function velocityDays(rows: Array<{ createdAt: Date; updatedAt: Date }>): number | null {
    if (rows.length === 0) return null;
    const diffs = rows.map(
      (r) => (r.updatedAt.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    return mean(diffs);
  }

  const tenantVelocityDays = velocityDays(tenantCompletedTx) ?? 0;

  // Group completed platform transactions by company
  const platformVelocityByCompany = new Map<string, Array<{ createdAt: Date; updatedAt: Date }>>();
  for (const row of platformVelocityTx as TxVelocityRow[]) {
    if (!platformVelocityByCompany.has(row.companyId)) {
      platformVelocityByCompany.set(row.companyId, []);
    }
    platformVelocityByCompany.get(row.companyId)!.push({
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  const velocityDistribution: number[] = [];
  for (const rows of platformVelocityByCompany.values()) {
    const days = velocityDays(rows);
    if (days !== null && days > 0) velocityDistribution.push(days);
  }

  // ─── 3. Payment default rate ──────────────────────────────────────────────

  function defaultRate(
    groups: Array<{ paymentStatus: string; _count: { id: number } }>,
  ): number | null {
    const total = groups.reduce((s, g) => s + g._count.id, 0);
    if (total < MIN_TX_FOR_DEFAULT) return null;
    const overdue = groups.find((g) => g.paymentStatus === "OVERDUE")?._count.id ?? 0;
    return (overdue / total) * 100;
  }

  const tenantDefaultRate =
    defaultRate(tenantTxStatusGroups as Array<{ paymentStatus: string; _count: { id: number } }>) ?? 0;

  // Group platform status rows by company
  const platformStatusByCompany = new Map<
    string,
    Array<{ paymentStatus: string; _count: { id: number } }>
  >();
  for (const row of platformTxStatusGroups as TxStatusGroupRow[]) {
    if (!platformStatusByCompany.has(row.companyId)) {
      platformStatusByCompany.set(row.companyId, []);
    }
    platformStatusByCompany.get(row.companyId)!.push({
      paymentStatus: row.paymentStatus,
      _count: row._count,
    });
  }

  const defaultRateDistribution: number[] = [];
  for (const groups of platformStatusByCompany.values()) {
    const rate = defaultRate(groups);
    if (rate !== null) defaultRateDistribution.push(rate);
  }

  // ─── 4. Property type breakdown ───────────────────────────────────────────

  // Tenant: group transactions by property type
  type TypeAccumulator = {
    dealCount: number;
    completedDeals: number;
    revenue: number;
  };

  const typeMap = new Map<string, TypeAccumulator>();
  for (const tx of tenantTxWithTypes as TxPropertyRow[]) {
    const pType = tx.property?.propertyType ?? "UNKNOWN";
    if (!typeMap.has(pType)) {
      typeMap.set(pType, { dealCount: 0, completedDeals: 0, revenue: 0 });
    }
    const acc = typeMap.get(pType)!;
    acc.dealCount++;
    if (COMPLETED_STAGES.includes(tx.currentStage as typeof COMPLETED_STAGES[number])) {
      acc.completedDeals++;
    }
    for (const p of tx.payments) {
      acc.revenue += decimalToNumber(p.amount);
    }
  }

  // Platform: total properties by type (for share calculation)
  const platformTypeGroups = platformPropertyTypeGroups as PropertyTypeGroupRow[];
  const platformTotalProperties = platformTypeGroups.reduce((s, g) => s + g._count.id, 0);
  const platformTypeShareMap = new Map<string, number>(
    platformTypeGroups.map((g) => [
      g.propertyType,
      platformTotalProperties > 0 ? (g._count.id / platformTotalProperties) * 100 : 0,
    ]),
  );

  const topPropertyTypes: PropertyTypeBenchmark[] = [...typeMap.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .map(([type, acc]) => ({
      type,
      tenantDealCount: acc.dealCount,
      tenantCompletedDeals: acc.completedDeals,
      tenantRevenue: acc.revenue,
      tenantCompletionRate:
        acc.dealCount > 0 ? (acc.completedDeals / acc.dealCount) * 100 : 0,
      platformTypeShare: platformTypeShareMap.get(type) ?? 0,
    }));

  // ─── Assemble final report ────────────────────────────────────────────────

  return {
    inquiryToReservation: buildBand(tenantConversionRate, conversionDistribution, false),
    dealVelocity: buildBand(tenantVelocityDays, velocityDistribution, true),
    paymentDefaultRate: buildBand(tenantDefaultRate, defaultRateDistribution, true),
    topPropertyTypes,
    windowDays: BENCHMARK_WINDOW_DAYS,
    generatedAt: new Date(),
  };
}
