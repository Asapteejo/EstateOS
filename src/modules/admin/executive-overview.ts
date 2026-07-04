import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { buildSafeErrorLogContext, logError } from "@/lib/ops/logger";
import { formatCurrency } from "@/lib/utils";

export type ExecTone = "brand" | "amber" | "green" | "red" | "neutral";

export type ExecKpi = {
  key: string;
  label: string;
  value: string;
  tone: ExecTone;
};

export type ExecSection = {
  key: string;
  title: string;
  icon: string;
  kpis: ExecKpi[];
};

export type ExecutiveOverview = {
  sections: ExecSection[];
};

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function buildSections(values: {
  activeLeads: number;
  liveListings: number;
  unitsSold: number;
  collectedThisMonth: number;
  outstanding: number;
  overdue: number;
  newLeadsToday: number;
  viewingsToday: number;
  awaitingResponse: number;
}): ExecSection[] {
  return [
    {
      key: "sales",
      title: "Sales",
      icon: "TrendingUp",
      kpis: [
        { key: "activeLeads", label: "Active leads", value: String(values.activeLeads), tone: "brand" },
        { key: "liveListings", label: "Live listings", value: String(values.liveListings), tone: "neutral" },
        { key: "unitsSold", label: "Units sold", value: String(values.unitsSold), tone: "green" },
      ],
    },
    {
      key: "finance",
      title: "Finance",
      icon: "Wallet",
      kpis: [
        { key: "collected", label: "Collected this month", value: formatCurrency(values.collectedThisMonth), tone: "green" },
        { key: "outstanding", label: "Outstanding", value: formatCurrency(values.outstanding), tone: "amber" },
        { key: "overdue", label: "Overdue payments", value: String(values.overdue), tone: "red" },
      ],
    },
    {
      key: "frontDesk",
      title: "Front desk",
      icon: "ConciergeBell",
      kpis: [
        { key: "newLeadsToday", label: "New leads today", value: String(values.newLeadsToday), tone: "brand" },
        { key: "viewingsToday", label: "Viewings today", value: String(values.viewingsToday), tone: "brand" },
        { key: "awaitingResponse", label: "Awaiting response", value: String(values.awaitingResponse), tone: "amber" },
      ],
    },
  ];
}

function emptyOverview(): ExecutiveOverview {
  return {
    sections: buildSections({
      activeLeads: 0,
      liveListings: 0,
      unitsSold: 0,
      collectedThisMonth: 0,
      outstanding: 0,
      overdue: 0,
      newLeadsToday: 0,
      viewingsToday: 0,
      awaitingResponse: 0,
    }),
  };
}

/**
 * Company-wide snapshot for the owner: a single view spanning sales, finance, and
 * front-desk health. Composed from existing models and never throws — returns a
 * zeroed snapshot on any failure so the landing always renders.
 */
export async function getExecutiveOverview(context: {
  companyId: string | null;
}): Promise<ExecutiveOverview> {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return emptyOverview();
  }

  const companyId = context.companyId;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  try {
    const [
      activeLeads,
      liveListings,
      unitsSold,
      collectedAgg,
      outstandingAgg,
      overdue,
      newLeadsToday,
      viewingsToday,
      awaitingResponse,
    ] = await Promise.all([
      prisma.inquiry.count({ where: { companyId, status: { notIn: ["CLOSED", "LOST", "CONVERTED"] } } }),
      prisma.property.count({ where: { companyId, status: "AVAILABLE" } }),
      prisma.property.count({ where: { companyId, status: "SOLD" } }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { companyId, status: "SUCCESS", paidAt: { gte: startOfMonth } },
      }),
      prisma.transaction.aggregate({ _sum: { outstandingBalance: true }, where: { companyId } }),
      prisma.payment.count({ where: { companyId, status: "OVERDUE" } }),
      prisma.inquiry.count({ where: { companyId, createdAt: { gte: startOfToday } } }),
      prisma.inspectionBooking.count({
        where: { companyId, scheduledFor: { gte: startOfToday, lt: startOfTomorrow } },
      }),
      prisma.inquiry.count({ where: { companyId, status: "NEW" } }),
    ]);

    return {
      sections: buildSections({
        activeLeads,
        liveListings,
        unitsSold,
        collectedThisMonth: toNumber(collectedAgg._sum.amount),
        outstanding: toNumber(outstandingAgg._sum.outstandingBalance),
        overdue,
        newLeadsToday,
        viewingsToday,
        awaitingResponse,
      }),
    };
  } catch (error) {
    logError("Executive overview lookup failed; returning empty snapshot.", {
      route: "/admin/overview",
      companyId,
      ...buildSafeErrorLogContext(error),
    });
    return emptyOverview();
  }
}
