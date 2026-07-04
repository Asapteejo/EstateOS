import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { buildSafeErrorLogContext, logError } from "@/lib/ops/logger";
import { formatCurrency } from "@/lib/utils";

export type FinanceTone = "brand" | "amber" | "green" | "red" | "neutral";

export type FinanceStat = {
  key: string;
  label: string;
  value: string;
  tone: FinanceTone;
  icon: string;
};

export type FinancePayment = {
  id: string;
  payer: string;
  amount: string;
  reference: string;
  when: string;
};

export type FinanceOverview = {
  stats: FinanceStat[];
  recentPayments: FinancePayment[];
};

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function buildStats(values: {
  collectedThisMonth: number;
  collectedToday: number;
  outstanding: number;
  overdueCount: number;
  pendingCount: number;
  paymentsThisMonth: number;
}): FinanceStat[] {
  return [
    { key: "collectedThisMonth", label: "Collected this month", value: formatCurrency(values.collectedThisMonth), tone: "green", icon: "Wallet" },
    { key: "collectedToday", label: "Collected today", value: formatCurrency(values.collectedToday), tone: "brand", icon: "TrendingUp" },
    { key: "outstanding", label: "Outstanding", value: formatCurrency(values.outstanding), tone: "amber", icon: "Hourglass" },
    { key: "overdueCount", label: "Overdue payments", value: String(values.overdueCount), tone: "red", icon: "AlertTriangle" },
    { key: "pendingCount", label: "Pending payments", value: String(values.pendingCount), tone: "neutral", icon: "Clock" },
    { key: "paymentsThisMonth", label: "Payments this month", value: String(values.paymentsThisMonth), tone: "neutral", icon: "ReceiptText" },
  ];
}

function emptyOverview(): FinanceOverview {
  return {
    stats: buildStats({
      collectedThisMonth: 0,
      collectedToday: 0,
      outstanding: 0,
      overdueCount: 0,
      pendingCount: 0,
      paymentsThisMonth: 0,
    }),
    recentPayments: [],
  };
}

function relativeTime(date: Date, now: Date): string {
  const mins = Math.round((now.getTime() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

/**
 * Accountant snapshot: cash collected, what is still outstanding/overdue, and the
 * latest successful payments. Built from existing Payment / Transaction data and
 * never throws — returns a zeroed snapshot on any failure so the page always
 * renders.
 */
export async function getFinanceOverview(context: {
  companyId: string | null;
}): Promise<FinanceOverview> {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return emptyOverview();
  }

  const companyId = context.companyId;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  try {
    const [
      collectedMonthAgg,
      collectedTodayAgg,
      outstandingAgg,
      overdueCount,
      pendingCount,
      paymentsThisMonth,
      recent,
    ] = await Promise.all([
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { companyId, status: "SUCCESS", paidAt: { gte: startOfMonth } },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { companyId, status: "SUCCESS", paidAt: { gte: startOfToday } },
      }),
      prisma.transaction.aggregate({
        _sum: { outstandingBalance: true },
        where: { companyId },
      }),
      prisma.payment.count({ where: { companyId, status: "OVERDUE" } }),
      prisma.payment.count({
        where: { companyId, status: { in: ["PENDING", "PROCESSING", "AWAITING_INITIATION"] } },
      }),
      prisma.payment.count({ where: { companyId, status: "SUCCESS", paidAt: { gte: startOfMonth } } }),
      prisma.payment.findMany({
        where: { companyId, status: "SUCCESS" },
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        take: 8,
        select: {
          id: true,
          amount: true,
          currency: true,
          paidAt: true,
          createdAt: true,
          providerReference: true,
          user: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    const recentPayments: FinancePayment[] = recent.map((row) => {
      const payer = [row.user?.firstName, row.user?.lastName].filter(Boolean).join(" ").trim() || "A buyer";
      const at = row.paidAt ?? row.createdAt;
      return {
        id: row.id,
        payer,
        amount: formatCurrency(toNumber(row.amount), row.currency ?? "NGN"),
        reference: row.providerReference,
        when: relativeTime(at, now),
      };
    });

    return {
      stats: buildStats({
        collectedThisMonth: toNumber(collectedMonthAgg._sum.amount),
        collectedToday: toNumber(collectedTodayAgg._sum.amount),
        outstanding: toNumber(outstandingAgg._sum.outstandingBalance),
        overdueCount,
        pendingCount,
        paymentsThisMonth,
      }),
      recentPayments,
    };
  } catch (error) {
    logError("Finance overview lookup failed; returning empty snapshot.", {
      route: "/admin/finance",
      companyId,
      ...buildSafeErrorLogContext(error),
    });
    return emptyOverview();
  }
}
