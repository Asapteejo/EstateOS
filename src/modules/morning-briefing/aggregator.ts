/**
 * Morning briefing data aggregator.
 *
 * Gathers the four sections of the daily digest for one company:
 *   1. Overdue payments — count + total amount at risk
 *   2. Today's inspections — confirmed/rescheduled between 00:00–23:59 UTC
 *   3. Stalled deals — in-progress transactions with no activity for 7+ days
 *   4. Urgent alerts — hidden properties and KYC submissions awaiting review
 *
 * All queries run in parallel (Promise.all). The function is pure with respect
 * to side-effects — callers decide what to do with the result.
 */

import { endOfDay, startOfDay, subDays, differenceInDays } from "date-fns";

import { prisma } from "@/lib/db/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";

type Decimalish = { toNumber?: () => number } | number | null | undefined;

function dec(value: Decimalish): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : value.toNumber?.() ?? Number(value);
}

export interface OverduePaymentRow {
  reservationRef: string;
  buyerName: string;
  outstandingBalance: string;
  daysOverdue: number;
}

export interface InspectionRow {
  fullName: string;
  propertyTitle: string;
  scheduledAt: string; // formatted time
}

export interface StalledDealRow {
  reservationRef: string;
  buyerName: string;
  currentStage: string;
  daysSinceActivity: number;
}

export interface AtRiskDealRow {
  reservationRef: string;
  buyerName: string;
  riskScore: number;
  topSignal: string;
}

export interface MorningBriefingData {
  companyId: string;
  companyName: string;
  date: string; // e.g. "Tuesday, 15 April 2026"

  // Section 1 — overdue payments
  overdueCount: number;
  overdueTotalAtRisk: string;
  overdueRows: OverduePaymentRow[];

  // Section 2 — today's inspections
  inspectionCount: number;
  inspectionRows: InspectionRow[];

  // Section 3 — stalled deals
  stalledCount: number;
  stalledRows: StalledDealRow[];

  // Section 4 — urgent alerts (scalar counts only — no detail rows needed)
  hiddenProperties: number;
  pendingKyc: number;

  // Section 5 — at-risk deals (top 5 by score)
  atRiskCount: number;
  atRiskRows: AtRiskDealRow[];
}

const STALE_DEAL_DAYS = 7;

/** Formats a TransactionStage enum value into a readable label. */
function stageLabel(stage: string): string {
  return stage
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function getMorningBriefingData(
  companyId: string,
  now: Date = new Date(),
): Promise<MorningBriefingData> {
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const staleThreshold = subDays(now, STALE_DEAL_DAYS);

  const [company, overdueAgg, overdueRows, inspectionRows, stalledRows, hiddenProps, pendingKyc, atRiskRows] =
    await Promise.all([
      // Company name
      prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      }),

      // Overdue aggregate: count + sum
      prisma.transaction.aggregate({
        where: { companyId, paymentStatus: "OVERDUE" },
        _count: { _all: true },
        _sum: { outstandingBalance: true },
      }),

      // Overdue rows — top 5, oldest due-date first
      prisma.transaction.findMany({
        where: { companyId, paymentStatus: "OVERDUE" },
        orderBy: { nextPaymentDueAt: "asc" },
        take: 5,
        select: {
          nextPaymentDueAt: true,
          outstandingBalance: true,
          reservation: { select: { reference: true } },
          user: { select: { firstName: true, lastName: true } },
        },
      }),

      // Today's inspections — confirmed or rescheduled
      prisma.inspectionBooking.findMany({
        where: {
          companyId,
          status: { in: ["CONFIRMED", "RESCHEDULED"] },
          scheduledFor: { gte: dayStart, lte: dayEnd },
        },
        orderBy: { scheduledFor: "asc" },
        take: 10,
        select: {
          fullName: true,
          scheduledFor: true,
          property: { select: { title: true } },
        },
      }),

      // Stalled deals — in-progress, no activity for 7+ days
      prisma.transaction.findMany({
        where: {
          companyId,
          currentStage: {
            notIn: ["FINAL_PAYMENT_COMPLETED", "HANDOVER_COMPLETED"],
          },
          paymentStatus: { notIn: ["COMPLETED"] },
          updatedAt: { lte: staleThreshold },
        },
        orderBy: { updatedAt: "asc" },
        take: 5,
        select: {
          currentStage: true,
          updatedAt: true,
          reservation: { select: { reference: true } },
          user: { select: { firstName: true, lastName: true } },
        },
      }),

      // Hidden / unverified properties
      prisma.property.count({
        where: {
          companyId,
          OR: [{ isPubliclyVisible: false }, { verificationStatus: { not: "VERIFIED" } }],
        },
      }),

      // KYC submissions awaiting review
      prisma.kYCSubmission.count({
        where: { companyId, status: "SUBMITTED" },
      }),

      // Top 5 at-risk deals (riskScore >= 50), highest score first
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma.transaction.findMany as (args: any) => Promise<any[]>)({
        where: {
          companyId,
          riskScore: { gte: 50 },
          currentStage: { notIn: ["FINAL_PAYMENT_COMPLETED", "HANDOVER_COMPLETED"] },
        },
        orderBy: { riskScore: "desc" },
        take: 5,
        select: {
          riskScore: true,
          reservation: { select: { reference: true } },
          user: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

  const companyName = company?.name ?? "EstateOS";

  type OverdueRaw = {
    nextPaymentDueAt: Date | null;
    outstandingBalance: Decimalish;
    reservation: { reference: string } | null;
    user: { firstName: string | null; lastName: string | null };
  };
  type InspectionRaw = {
    fullName: string;
    scheduledFor: Date;
    property: { title: string };
  };
  type StalledRaw = {
    currentStage: string;
    updatedAt: Date;
    reservation: { reference: string } | null;
    user: { firstName: string | null; lastName: string | null };
  };

  const formattedOverdueRows: OverduePaymentRow[] = (overdueRows as OverdueRaw[]).map((row) => ({
    reservationRef: row.reservation?.reference ?? "—",
    buyerName: `${row.user.firstName ?? ""} ${row.user.lastName ?? ""}`.trim() || "Buyer",
    outstandingBalance: formatCurrency(dec(row.outstandingBalance)),
    daysOverdue: row.nextPaymentDueAt ? differenceInDays(now, row.nextPaymentDueAt) : 0,
  }));

  const formattedInspectionRows: InspectionRow[] = (inspectionRows as InspectionRaw[]).map((row) => ({
    fullName: row.fullName,
    propertyTitle: row.property.title,
    scheduledAt: formatDate(row.scheduledFor, "p"), // e.g. "10:00 AM"
  }));

  const formattedStalledRows: StalledDealRow[] = (stalledRows as StalledRaw[]).map((row) => ({
    reservationRef: row.reservation?.reference ?? "—",
    buyerName: `${row.user.firstName ?? ""} ${row.user.lastName ?? ""}`.trim() || "Buyer",
    currentStage: stageLabel(row.currentStage),
    daysSinceActivity: differenceInDays(now, row.updatedAt),
  }));

  type AtRiskRaw = {
    riskScore: number;
    reservation: { reference: string } | null;
    user: { firstName: string | null; lastName: string | null };
  };

  const formattedAtRiskRows: AtRiskDealRow[] = (atRiskRows as AtRiskRaw[]).map((row) => ({
    reservationRef: row.reservation?.reference ?? "—",
    buyerName: `${row.user.firstName ?? ""} ${row.user.lastName ?? ""}`.trim() || "Buyer",
    riskScore: row.riskScore,
    topSignal: row.riskScore >= 80 ? "High risk" : row.riskScore >= 65 ? "Elevated risk" : "At risk",
  }));

  return {
    companyId,
    companyName,
    date: formatDate(now, "PPPP"), // "Tuesday, 15 April 2026"
    overdueCount: overdueAgg._count._all,
    overdueTotalAtRisk: formatCurrency(dec(overdueAgg._sum.outstandingBalance)),
    overdueRows: formattedOverdueRows,
    inspectionCount: inspectionRows.length,
    inspectionRows: formattedInspectionRows,
    stalledCount: formattedStalledRows.length,
    stalledRows: formattedStalledRows,
    hiddenProperties: hiddenProps,
    pendingKyc,
    atRiskCount: formattedAtRiskRows.length,
    atRiskRows: formattedAtRiskRows,
  };
}
