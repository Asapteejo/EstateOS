import { type BillingInterval, type PaymentRequestStatus, type SubscriptionStatus } from "@prisma/client";
import { formatDistanceToNowStrict, startOfDay, startOfMonth, subDays } from "date-fns";

import { getPlatformAnalyticsReport, type AnalyticsRange } from "@/modules/analytics/aggregates";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { buildSafeErrorLogContext, logError } from "@/lib/ops/logger";
import { formatCurrency, formatDate } from "@/lib/utils";

type Decimalish = { toNumber?: () => number } | number | null | undefined;

export type SuperadminRange = "today" | "7d" | "30d" | "all";
export type CompanyHealth = "healthy" | "collections_risk" | "inactive" | "onboarding_incomplete" | "high_value";
export type CompanySort =
  | "highest_revenue"
  | "highest_overdue"
  | "newest"
  | "most_active"
  | "highest_inflow";
export type CompanyQuickFilter = "all" | "inactive" | "collections-risk" | "payout-missing";
export const SUPERADMIN_COMPANY_QUERY_LIMIT = 250;
export const SUPERADMIN_COMPANY_TABLE_LIMIT = 100;
export const SUPERADMIN_ACTIVITY_FEED_LIMIT = 28;
export const SUPERADMIN_SNAPSHOT_QUERY_LIMIT = 5_000;

export function limitSuperadminRows<T>(rows: T[], limit: number) {
  return rows.slice(0, limit);
}

type PlanSummaryInput = {
  companyName: string;
  subscriptionStatus: string | null;
  planName: string | null;
  interval: BillingInterval | string | null;
  hasActivePayout: boolean;
};

type CompanyBaseRecord = {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED" | "DISABLED";
  suspendedAt: Date | null;
  suspensionReason: string | null;
  customDomain: string | null;
  subdomain: string | null;
  createdAt: Date;
  subscriptions: Array<{
    id: string;
    status: SubscriptionStatus;
    interval: BillingInterval;
    startsAt: Date;
    endsAt: Date | null;
    cancelledAt: Date | null;
    plan: {
      id: string;
      name: string;
      slug: string;
      interval: BillingInterval;
      priceAmount: Decimalish;
      currency: string;
    };
  }>;
  providerAccounts: Array<{
    id: string;
    provider: string;
    status: string;
    supportsTransactionSplit: boolean;
    supportsSubscriptions: boolean;
    isDefaultPayout: boolean;
    splitCode: string | null;
    subaccountCode: string | null;
    updatedAt: Date;
  }>;
  billingSettings: {
    defaultCurrency: string;
    transactionProvider: string;
    subscriptionProvider: string | null;
    requireActivePlanForTransactions: boolean;
    requireActivePlanForAdminOps: boolean;
    notes: string | null;
    defaultCommissionRule: {
      id: string;
      name: string;
      code: string;
      feeType: string;
      flatAmount: Decimalish;
      percentageRate: Decimalish;
      currency: string;
      isActive: boolean;
    } | null;
  } | null;
  _count: {
    properties: number;
    teamMembers: number;
    transactions: number;
    paymentRequests: number;
    payments: number;
    reservations: number;
  };
};

type CompanyMetricRow = {
  companyId: string;
  companyName: string;
  companySlug: string;
  companyStatus: "ACTIVE" | "SUSPENDED" | "DISABLED";
  suspendedAt: Date | null;
  suspensionReason: string | null;
  publicDomain: string;
  createdAt: Date;
  subscriptionStatus: string;
  subscriptionPlan: string;
  subscriptionInterval: string;
  planLabel: string;
  payoutReadiness: string;
  platformRevenue: number;
  platformRevenueFormatted: string;
  inflowProcessed: number;
  inflowFormatted: string;
  successfulPayments: number;
  paymentRequestsSent: number;
  overdueAmount: number;
  overdueFormatted: string;
  totalDeals: number;
  propertiesCount: number;
  teamCount: number;
  lastActiveAt: Date | null;
  lastActiveLabel: string;
  health: CompanyHealth;
  healthReason: string;
  subscriptionRevenue: number;
  commissionRevenue: number;
  currentPlanPrice: number;
  defaultCurrency: string;
  currentPlanId: string | null;
  currentSubscriptionId: string | null;
  billingProvider: string;
  commissionRuleLabel: string;
  providerReadinessLabel: string;
};

type ActivityFeedItem = {
  id: string;
  timestamp: Date;
  type:
    | "payment_completed"
    | "payment_request_sent"
    | "company_onboarded"
    | "company_created"
    | "overdue_detected"
    | "subscription_revenue"
    | "webhook_alert"
    | "job_failure";
  companyId: string | null;
  companyName: string;
  title: string;
  summary: string;
  amount: number | null;
  amountLabel: string | null;
  accent: "positive" | "alert" | "neutral";
};

async function runSuperadminOverviewQuery<T>(
  queryName: string,
  fallback: NoInfer<T>,
  query: () => Promise<T>,
  context?: {
    route?: string;
    component?: string;
  },
) {
  try {
    return await query();
  } catch (error) {
    logError("Superadmin overview query failed; using empty-state fallback.", {
      route: context?.route ?? "/superadmin",
      component: context?.component ?? "SuperadminDashboardPage",
      queryName,
      ...buildSafeErrorLogContext(error),
    });
    return fallback;
  }
}

function buildEmptyPlatformAnalytics(range: SuperadminRange) {
  const window = getRangeWindow(range);
  return {
    generatedAt: new Date(),
    range: window,
    companies: [] as CompanyMetricRow[],
    overview: {
      totalCompanies: 0,
      activeCompanies: 0,
      newCompaniesThisMonth: 0,
      totalPlatformInflow: 0,
      subscriptionRevenue: 0,
      commissionRevenue: 0,
      totalPlatformRevenue: 0,
      totalSuccessfulPayments: 0,
      overdueAmount: 0,
      totalDeals: 0,
      inflowTrend: "No platform activity available",
      revenueTrend: "No platform activity available",
    },
    recentActivity: [] as ActivityFeedItem[],
    plans: [] as Array<{
      id: string;
      name: string;
      interval: BillingInterval;
      priceAmount: number;
      currency: string;
      subscriberCount: number;
      isActive: boolean;
    }>,
    trendSeries: [] as Array<{
      label: string;
      inflow: number;
      platformRevenue: number;
      subscriptionRevenue: number;
      commissionRevenue: number;
      signups: number;
      overdueExposure: number;
    }>,
    controls: {
      missingPayoutSetup: 0,
      inactiveCompanies: 0,
      collectionsRiskCompanies: 0,
      recentWebhookIssues: [] as Array<{
        id: string;
        companyName: string;
        eventType: string;
        createdAt: string;
        provider: string;
      }>,
      recentJobFailures: [] as Array<{
        id: string;
        companyName: string;
        jobName: string;
        error: string;
        createdAt: string;
      }>,
    },
  };
}

async function loadPlatformAnalyticsForRoute(
  range: SuperadminRange,
  route: string,
  component: string,
) {
  try {
    return await loadPlatformAnalytics(range);
  } catch (error) {
    logError("Superadmin route analytics failed; rendering empty state.", {
      route,
      component,
      queryName: "loadPlatformAnalytics",
      ...buildSafeErrorLogContext(error),
    });
    return buildEmptyPlatformAnalytics(range);
  }
}

function decimalToNumber(value: Decimalish) {
  if (typeof value === "number") {
    return value;
  }

  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber();
  }

  return 0;
}

function formatPercentChange(current: number, previous: number) {
  if (previous <= 0 && current <= 0) {
    return "No change vs previous period";
  }

  if (previous <= 0 && current > 0) {
    return "Up from zero in previous period";
  }

  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) {
    return "Flat vs previous period";
  }

  return `${percent > 0 ? "+" : ""}${percent}% vs previous period`;
}

function getRangeWindow(range: SuperadminRange, now = new Date()) {
  if (range === "today") {
    const from = startOfDay(now);
    return {
      range,
      label: "Today",
      from,
      previousFrom: subDays(from, 1),
      previousTo: from,
      bucket: "day" as const,
    };
  }

  if (range === "7d") {
    const from = subDays(now, 6);
    return {
      range,
      label: "Last 7 days",
      from,
      previousFrom: subDays(from, 7),
      previousTo: from,
      bucket: "day" as const,
    };
  }

  if (range === "30d") {
    const from = subDays(now, 29);
    return {
      range,
      label: "Last 30 days",
      from,
      previousFrom: subDays(from, 30),
      previousTo: from,
      bucket: "week" as const,
    };
  }

  return {
    range,
    label: "All time",
    from: null,
    previousFrom: null,
    previousTo: null,
    bucket: "month" as const,
  };
}

function toAnalyticsRange(range: SuperadminRange): AnalyticsRange {
  if (range === "today" || range === "7d") {
    return "7d";
  }

  if (range === "30d") {
    return "30d";
  }

  return "all";
}

async function loadCompanySnapshotMetrics(range: SuperadminRange, from: Date | null) {
  const rows = await prisma.analyticsDailySnapshot.findMany({
    where: {
      scope: "COMPANY",
      ...(from ? { bucketDate: { gte: startOfDay(from) } } : {}),
    },
    orderBy: [{ companyId: "asc" }, { bucketDate: "desc" }],
    take: SUPERADMIN_SNAPSHOT_QUERY_LIMIT,
    select: {
      companyId: true,
      bucketDate: true,
      platformInflow: true,
      successfulPaymentCount: true,
      subscriptionRevenue: true,
      commissionRevenue: true,
      overdueAmount: true,
    },
  });

  const metrics = new Map<
    string,
    {
      inflowProcessed: number;
      successfulPayments: number;
      subscriptionRevenue: number;
      commissionRevenue: number;
      overdueAmount: number;
    }
  >();
  const latestOverdueSeen = new Set<string>();

  for (const row of rows) {
    const companyId = row.companyId;
    if (!companyId) {
      continue;
    }

    const target = metrics.get(companyId) ?? {
      inflowProcessed: 0,
      successfulPayments: 0,
      subscriptionRevenue: 0,
      commissionRevenue: 0,
      overdueAmount: 0,
    };

    target.inflowProcessed += decimalToNumber(row.platformInflow);
    target.successfulPayments += row.successfulPaymentCount;
    target.subscriptionRevenue += decimalToNumber(row.subscriptionRevenue);
    target.commissionRevenue += decimalToNumber(row.commissionRevenue);

    if (!latestOverdueSeen.has(companyId)) {
      target.overdueAmount = decimalToNumber(row.overdueAmount);
      latestOverdueSeen.add(companyId);
    }

    metrics.set(companyId, target);
  }

  if (range === "today") {
    const todayKey = startOfDay(new Date()).getTime();
    for (const [companyId, metric] of metrics) {
      const todayRows = rows.filter(
        (row) => row.companyId === companyId && startOfDay(row.bucketDate).getTime() === todayKey,
      );
      if (todayRows.length < 1) {
        metrics.set(companyId, {
          ...metric,
          inflowProcessed: 0,
          successfulPayments: 0,
          subscriptionRevenue: 0,
          commissionRevenue: 0,
        });
      } else {
        metrics.set(companyId, {
          ...metric,
          inflowProcessed: todayRows.reduce((sum, row) => sum + decimalToNumber(row.platformInflow), 0),
          successfulPayments: todayRows.reduce((sum, row) => sum + row.successfulPaymentCount, 0),
          subscriptionRevenue: todayRows.reduce((sum, row) => sum + decimalToNumber(row.subscriptionRevenue), 0),
          commissionRevenue: todayRows.reduce((sum, row) => sum + decimalToNumber(row.commissionRevenue), 0),
        });
      }
    }
  }

  return metrics;
}

function buildPublicDomain(record: CompanyBaseRecord) {
  if (record.customDomain) {
    return record.customDomain;
  }

  if (record.subdomain) {
    return `${record.subdomain}.estateos.com`;
  }

  return `${record.slug}.estateos.com`;
}

export function buildEmptyCompanyMetricRow(record: {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED" | "DISABLED";
  suspendedAt: Date | null;
  suspensionReason: string | null;
  customDomain: string | null;
  subdomain: string | null;
  createdAt: Date;
}): CompanyMetricRow {
  return {
    companyId: record.id,
    companyName: record.name,
    companySlug: record.slug,
    companyStatus: record.status,
    suspendedAt: record.suspendedAt,
    suspensionReason: record.suspensionReason,
    publicDomain: record.customDomain ?? (record.subdomain ? `${record.subdomain}.estateos.com` : `${record.slug}.estateos.com`),
    createdAt: record.createdAt,
    subscriptionStatus: "NO_PLAN",
    subscriptionPlan: "No plan",
    subscriptionInterval: "n/a",
    planLabel: "No valid plan",
    payoutReadiness: "Payout setup missing",
    platformRevenue: 0,
    platformRevenueFormatted: formatCurrency(0),
    inflowProcessed: 0,
    inflowFormatted: formatCurrency(0),
    successfulPayments: 0,
    paymentRequestsSent: 0,
    overdueAmount: 0,
    overdueFormatted: formatCurrency(0),
    totalDeals: 0,
    propertiesCount: 0,
    teamCount: 0,
    lastActiveAt: null,
    lastActiveLabel: "No activity yet",
    health: "onboarding_incomplete",
    healthReason: "Optional company analytics are temporarily unavailable.",
    subscriptionRevenue: 0,
    commissionRevenue: 0,
    currentPlanPrice: 0,
    defaultCurrency: "NGN",
    currentPlanId: null,
    currentSubscriptionId: null,
    billingProvider: "PAYSTACK",
    commissionRuleLabel: "No default fee rule",
    providerReadinessLabel: "Payout setup missing",
  };
}

function buildCommissionRuleLabel(record: CompanyBaseRecord) {
  const rule = record.billingSettings?.defaultCommissionRule;

  if (!rule) {
    return "No default fee rule";
  }

  if (rule.feeType === "PERCENTAGE") {
    return `${decimalToNumber(rule.percentageRate)}% fee`;
  }

  return `Flat ${formatCurrency(decimalToNumber(rule.flatAmount), rule.currency)}`;
}

function buildPayoutReadiness(record: CompanyBaseRecord) {
  const defaultProvider = record.providerAccounts[0] ?? null;

  if (!defaultProvider) {
    return "Payout setup missing";
  }

  if (defaultProvider.status !== "ACTIVE") {
    return "Payout setup incomplete";
  }

  if (!defaultProvider.supportsTransactionSplit) {
    return "Split settlement disabled";
  }

  return "Payout ready";
}

function chooseCurrentSubscription(record: CompanyBaseRecord) {
  return record.subscriptions[0] ?? null;
}

export function buildCompaniesByPlanSummary(input: PlanSummaryInput[]) {
  const counts = new Map<string, number>();

  for (const company of input) {
    const label =
      company.planName && company.subscriptionStatus
        ? `${company.planName} ${String(company.interval ?? "").toLowerCase()}`
        : "No valid plan";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

export function buildCompanyAlertBuckets(input: PlanSummaryInput[]) {
  return {
    noValidPlan: input.filter((company) => !company.planName || !company.subscriptionStatus).length,
    missingPayoutSetup: input.filter((company) => !company.hasActivePayout).length,
  };
}

export function parseSuperadminRange(input?: string | null): SuperadminRange {
  if (input === "today" || input === "7d" || input === "30d" || input === "all") {
    return input;
  }

  return "30d";
}

export function parseCompanySort(input?: string | null): CompanySort {
  if (
    input === "highest_revenue" ||
    input === "highest_overdue" ||
    input === "newest" ||
    input === "most_active" ||
    input === "highest_inflow"
  ) {
    return input;
  }

  return "highest_revenue";
}

export function readSuperadminSearchParam(input: string | string[] | undefined) {
  return typeof input === "string" ? input : undefined;
}

export function parseCompanyHealthFilter(input?: string | null): CompanyHealth | "all" {
  if (
    input === "healthy" ||
    input === "collections_risk" ||
    input === "inactive" ||
    input === "onboarding_incomplete" ||
    input === "high_value"
  ) {
    return input;
  }

  return "all";
}

export function parseCompanyQuickFilter(input?: string | null): CompanyQuickFilter {
  if (input === "inactive" || input === "collections-risk" || input === "payout-missing") {
    return input;
  }

  return "all";
}

export function classifyCompanyHealth(input: {
  totalDeals: number;
  propertiesCount: number;
  teamCount: number;
  overdueAmount: number;
  inflowProcessed: number;
  platformRevenue: number;
  subscriptionStatus: string;
  lastActiveAt: Date | null;
}) {
  if (input.totalDeals < 1 || input.propertiesCount < 1 || input.teamCount < 1) {
    return {
      health: "onboarding_incomplete" as const,
      reason: "Missing a core setup step for revenue operations.",
    };
  }

  if (input.overdueAmount > 0 || input.subscriptionStatus === "PAST_DUE") {
    return {
      health: "collections_risk" as const,
      reason: "Overdue money or billing pressure needs attention.",
    };
  }

  if (!input.lastActiveAt || input.lastActiveAt.getTime() < subDays(new Date(), 21).getTime()) {
    return {
      health: "inactive" as const,
      reason: "No recent operating activity across the workspace.",
    };
  }

  if (input.platformRevenue >= 300000 || input.inflowProcessed >= 15000000) {
    return {
      health: "high_value" as const,
      reason: "Driving outsized revenue or payment volume on the platform.",
    };
  }

  return {
    health: "healthy" as const,
    reason: "Operating normally with recent activity and no collections pressure.",
  };
}

async function loadPlatformAnalytics(range: SuperadminRange) {
  const window = getRangeWindow(range);

  if (!featureFlags.hasDatabase) {
    return buildEmptyPlatformAnalytics(range);
  }

  const timeWhere = window.from ? { gte: window.from } : undefined;
  const previousWhere =
    window.previousFrom && window.previousTo
      ? {
          gte: window.previousFrom,
          lt: window.previousTo,
        }
      : undefined;
  const [platformReport, snapshotMetrics] = await Promise.all([
    runSuperadminOverviewQuery("platformAnalyticsReport", {
      range: toAnalyticsRange(range),
      generatedAt: new Date(),
      summary: {
        totalPlatformInflow: 0,
        successfulPayments: 0,
        totalDeals: 0,
        overdueAmount: 0,
        subscriptionRevenue: 0,
        commissionRevenue: 0,
        totalPlatformRevenue: 0,
        totalCompanies: 0,
        activeCompanies: 0,
      },
      trendSeries: [],
    }, () => getPlatformAnalyticsReport(toAnalyticsRange(range))),
    runSuperadminOverviewQuery("companySnapshotMetrics", new Map(), () =>
      loadCompanySnapshotMetrics(range, window.from)),
  ]);

  const useSnapshotMetrics = snapshotMetrics.size > 0;

  const [companies, latestActivities, latestPayments, latestRequests, latestTransactions, plans] = await Promise.all([
    runSuperadminOverviewQuery("companies", [], () => prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      take: SUPERADMIN_COMPANY_QUERY_LIMIT,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        suspendedAt: true,
        suspensionReason: true,
        customDomain: true,
        subdomain: true,
        createdAt: true,
        subscriptions: {
          where: { isCurrent: true },
          take: 1,
          orderBy: { startsAt: "desc" },
          select: {
            id: true,
            status: true,
            interval: true,
            startsAt: true,
            endsAt: true,
            cancelledAt: true,
            plan: {
              select: {
                id: true,
                name: true,
                slug: true,
                interval: true,
                priceAmount: true,
                currency: true,
              },
            },
          },
        },
        providerAccounts: {
          where: { isDefaultPayout: true },
          take: 1,
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            provider: true,
            status: true,
            supportsTransactionSplit: true,
            supportsSubscriptions: true,
            isDefaultPayout: true,
            splitCode: true,
            subaccountCode: true,
            updatedAt: true,
          },
        },
        billingSettings: {
          select: {
            defaultCurrency: true,
            transactionProvider: true,
            subscriptionProvider: true,
            requireActivePlanForTransactions: true,
            requireActivePlanForAdminOps: true,
            notes: true,
            defaultCommissionRule: {
              select: {
                id: true,
                name: true,
                code: true,
                feeType: true,
                flatAmount: true,
                percentageRate: true,
                currency: true,
                isActive: true,
              },
            },
          },
        },
        _count: {
          select: {
            properties: true,
            teamMembers: true,
            transactions: true,
            paymentRequests: true,
            payments: true,
            reservations: true,
          },
        },
      },
    })),
    runSuperadminOverviewQuery("latestActivities", [], () => prisma.activityEvent.groupBy({
      by: ["companyId"],
      _max: { createdAt: true },
    })),
    runSuperadminOverviewQuery("latestPayments", [], () => prisma.payment.groupBy({
      by: ["companyId"],
      where: { status: "SUCCESS" },
      _max: { paidAt: true, createdAt: true },
    })),
    runSuperadminOverviewQuery("latestPaymentRequests", [], () => prisma.paymentRequest.groupBy({
      by: ["companyId"],
      _max: { sentAt: true, createdAt: true },
    })),
    runSuperadminOverviewQuery("latestTransactions", [], () => prisma.transaction.groupBy({
      by: ["companyId"],
      _max: { updatedAt: true, createdAt: true },
    })),
    runSuperadminOverviewQuery("plans", [], () => prisma.plan.findMany({
      orderBy: [{ code: "asc" }, { interval: "asc" }],
      include: {
        _count: {
          select: {
            subscriptions: {
              where: {
                isCurrent: true,
                status: {
                  in: ["ACTIVE", "TRIAL", "GRANTED"],
                },
              },
            },
          },
        },
      },
    })),
  ]);

  const [paymentAgg, commissionAgg, subscriptionAgg, overdueAgg] = useSnapshotMetrics
    ? [[], [], [], []]
    : await Promise.all([
        runSuperadminOverviewQuery("paymentAggregates", [], () => prisma.payment.groupBy({
          by: ["companyId"],
          where: {
            status: "SUCCESS",
            ...(timeWhere ? { paidAt: timeWhere } : {}),
          },
          _sum: { amount: true },
          _count: { _all: true },
        })),
        runSuperadminOverviewQuery("commissionAggregates", [], () => prisma.commissionRecord.groupBy({
          by: ["companyId"],
          where: {
            ...(timeWhere ? { createdAt: timeWhere } : {}),
          },
          _sum: { platformCommission: true },
        })),
        runSuperadminOverviewQuery("subscriptionAggregates", [], () => prisma.billingEvent.groupBy({
          by: ["companyId"],
          where: {
            type: "SUBSCRIPTION_PAYMENT_RECORDED",
            ...(timeWhere ? { createdAt: timeWhere } : {}),
          },
          _sum: { amount: true },
        })),
        runSuperadminOverviewQuery("overdueAggregates", [], () => prisma.transaction.groupBy({
          by: ["companyId"],
          where: {
            paymentStatus: "OVERDUE",
          },
          _sum: { outstandingBalance: true },
        })),
      ]);

  const [
    previousPaymentAgg,
    previousCommissionAgg,
    previousSubscriptionAgg,
    recentSuccessfulPayments,
    recentPaymentRequests,
    recentBillingEvents,
    recentCompanyActivity,
    recentWebhookIssues,
    recentJobFailures,
  ] = await Promise.all([
    previousWhere
      ? runSuperadminOverviewQuery("previousPaymentAggregate", { _sum: { amount: null }, _count: { _all: 0 } }, () => prisma.payment.aggregate({
          where: {
            status: "SUCCESS",
            paidAt: previousWhere,
          },
          _sum: { amount: true },
          _count: { _all: true },
        }))
      : Promise.resolve({ _sum: { amount: null }, _count: { _all: 0 } }),
    previousWhere
      ? runSuperadminOverviewQuery("previousCommissionAggregate", { _sum: { platformCommission: null } }, () => prisma.commissionRecord.aggregate({
          where: {
            createdAt: previousWhere,
          },
          _sum: { platformCommission: true },
        }))
      : Promise.resolve({ _sum: { platformCommission: null } }),
    previousWhere
      ? runSuperadminOverviewQuery("previousSubscriptionAggregate", { _sum: { amount: null } }, () => prisma.billingEvent.aggregate({
          where: {
            type: "SUBSCRIPTION_PAYMENT_RECORDED",
            createdAt: previousWhere,
          },
          _sum: { amount: true },
        }))
      : Promise.resolve({ _sum: { amount: null } }),
    runSuperadminOverviewQuery("recentSuccessfulPayments", [], () => prisma.payment.findMany({
      where: { status: "SUCCESS", paidAt: { not: null } },
      orderBy: { paidAt: "desc" },
      take: 18,
      select: {
        id: true,
        companyId: true,
        paidAt: true,
        amount: true,
        currency: true,
        providerReference: true,
        createdAt: true,
        company: { select: { name: true } },
      },
    })),
    runSuperadminOverviewQuery("recentPaymentRequests", [], () => prisma.paymentRequest.findMany({
      where: {
        status: {
          in: ["SENT", "AWAITING_PAYMENT", "PAID"] satisfies PaymentRequestStatus[],
        },
      },
      orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
      take: 18,
      select: {
        id: true,
        companyId: true,
        title: true,
        amount: true,
        currency: true,
        status: true,
        sentAt: true,
        createdAt: true,
        company: { select: { name: true } },
      },
    })),
    runSuperadminOverviewQuery("recentBillingEvents", [], () => prisma.billingEvent.findMany({
      where: {
        type: "SUBSCRIPTION_PAYMENT_RECORDED",
      },
      orderBy: { createdAt: "desc" },
      take: 18,
      select: {
        id: true,
        companyId: true,
        type: true,
        amount: true,
        currency: true,
        summary: true,
        createdAt: true,
        company: { select: { name: true } },
      },
    })),
    runSuperadminOverviewQuery("recentCompanyActivity", [], () => prisma.activityEvent.findMany({
      where: {
        eventName: {
          in: [
            "company.onboarded",
            "company.created",
            "company.suspended",
            "company.reactivated",
            "payment.overdue_detected",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 18,
      select: {
        id: true,
        companyId: true,
        eventName: true,
        summary: true,
        createdAt: true,
        company: { select: { name: true } },
      },
    })),
    runSuperadminOverviewQuery("recentWebhookIssues", [], () => prisma.webhookEvent.findMany({
      where: {
        signatureVerified: false,
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        companyId: true,
        eventType: true,
        provider: true,
        createdAt: true,
        company: { select: { name: true } },
      },
    })),
    runSuperadminOverviewQuery("recentJobFailures", [], () => prisma.backgroundJobLog.findMany({
      where: {
        status: {
          notIn: ["SUCCESS", "COMPLETED"],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        companyId: true,
        jobName: true,
        error: true,
        createdAt: true,
        company: { select: { name: true } },
      },
    })),
  ]);

  const paymentMap = useSnapshotMetrics
    ? new Map(
        [...snapshotMetrics.entries()].map(([companyId, metrics]) => [
          companyId,
          { amount: metrics.inflowProcessed, count: metrics.successfulPayments },
        ]),
      )
    : new Map(paymentAgg.map((row) => [row.companyId, { amount: decimalToNumber(row._sum.amount), count: row._count._all }]));
  const commissionMap = useSnapshotMetrics
    ? new Map([...snapshotMetrics.entries()].map(([companyId, metrics]) => [companyId, metrics.commissionRevenue]))
    : new Map(commissionAgg.map((row) => [row.companyId, decimalToNumber(row._sum.platformCommission)]));
  const subscriptionMap = useSnapshotMetrics
    ? new Map([...snapshotMetrics.entries()].map(([companyId, metrics]) => [companyId, metrics.subscriptionRevenue]))
    : new Map(subscriptionAgg.map((row) => [row.companyId ?? "unassigned", decimalToNumber(row._sum.amount)]));
  const overdueMap = useSnapshotMetrics
    ? new Map([...snapshotMetrics.entries()].map(([companyId, metrics]) => [companyId, metrics.overdueAmount]))
    : new Map(overdueAgg.map((row) => [row.companyId, decimalToNumber(row._sum.outstandingBalance)]));
  const activityMaxMap = new Map(latestActivities.map((row) => [row.companyId, row._max.createdAt]));
  const paymentMaxMap = new Map(latestPayments.map((row) => [row.companyId, row._max.paidAt ?? row._max.createdAt]));
  const requestMaxMap = new Map(latestRequests.map((row) => [row.companyId, row._max.sentAt ?? row._max.createdAt]));
  const transactionMaxMap = new Map(latestTransactions.map((row) => [row.companyId, row._max.updatedAt ?? row._max.createdAt]));

  const companyRows = (companies as CompanyBaseRecord[]).map((company) => {
    const subscription = chooseCurrentSubscription(company);
    const paymentStats = paymentMap.get(company.id) ?? { amount: 0, count: 0 };
    const subscriptionRevenue = subscriptionMap.get(company.id) ?? 0;
    const commissionRevenue = commissionMap.get(company.id) ?? 0;
    const inflowProcessed = paymentStats.amount;
    const overdueAmount = overdueMap.get(company.id) ?? 0;
    const platformRevenue = subscriptionRevenue + commissionRevenue;
    const lastActiveAt = [activityMaxMap.get(company.id), paymentMaxMap.get(company.id), requestMaxMap.get(company.id), transactionMaxMap.get(company.id)]
      .filter((value): value is Date => value instanceof Date)
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
    const classification = classifyCompanyHealth({
      totalDeals: company._count.transactions,
      propertiesCount: company._count.properties,
      teamCount: company._count.teamMembers,
      overdueAmount,
      inflowProcessed,
      platformRevenue,
      subscriptionStatus: subscription?.status ?? "NO_PLAN",
      lastActiveAt,
    });

    return {
      companyId: company.id,
      companyName: company.name,
      companySlug: company.slug,
      companyStatus: company.status,
      suspendedAt: company.suspendedAt,
      suspensionReason: company.suspensionReason,
      publicDomain: buildPublicDomain(company),
      createdAt: company.createdAt,
      subscriptionStatus: subscription?.status ?? "NO_PLAN",
      subscriptionPlan: subscription?.plan.name ?? "No plan",
      subscriptionInterval: subscription?.interval.toLowerCase() ?? "n/a",
      planLabel: subscription ? `${subscription.plan.name} ${subscription.interval.toLowerCase()}` : "No valid plan",
      payoutReadiness: buildPayoutReadiness(company),
      platformRevenue,
      platformRevenueFormatted: formatCurrency(platformRevenue, company.billingSettings?.defaultCurrency ?? "NGN"),
      inflowProcessed,
      inflowFormatted: formatCurrency(inflowProcessed, company.billingSettings?.defaultCurrency ?? "NGN"),
      successfulPayments: paymentStats.count,
      paymentRequestsSent: company._count.paymentRequests,
      overdueAmount,
      overdueFormatted: formatCurrency(overdueAmount, company.billingSettings?.defaultCurrency ?? "NGN"),
      totalDeals: company._count.transactions,
      propertiesCount: company._count.properties,
      teamCount: company._count.teamMembers,
      lastActiveAt,
      lastActiveLabel: lastActiveAt ? `${formatDistanceToNowStrict(lastActiveAt)} ago` : "No activity yet",
      health: classification.health,
      healthReason: classification.reason,
      subscriptionRevenue,
      commissionRevenue,
      currentPlanPrice: subscription ? decimalToNumber(subscription.plan.priceAmount) : 0,
      defaultCurrency: company.billingSettings?.defaultCurrency ?? "NGN",
      currentPlanId: subscription?.plan.id ?? null,
      currentSubscriptionId: subscription?.id ?? null,
      billingProvider: company.billingSettings?.transactionProvider ?? "PAYSTACK",
      commissionRuleLabel: buildCommissionRuleLabel(company),
      providerReadinessLabel: buildPayoutReadiness(company),
    } satisfies CompanyMetricRow;
  });

  const totalPlatformInflow = platformReport.summary.totalPlatformInflow;
  const totalSuccessfulPayments = platformReport.summary.successfulPayments;
  const totalDeals = platformReport.summary.totalDeals;
  const overdueAmount = platformReport.summary.overdueAmount;
  const subscriptionRevenue = platformReport.summary.subscriptionRevenue;
  const commissionRevenue = platformReport.summary.commissionRevenue;
  const totalPlatformRevenue = platformReport.summary.totalPlatformRevenue;

  const previousPlatformInflow = decimalToNumber(previousPaymentAgg._sum.amount);
  const previousPlatformRevenue =
    decimalToNumber(previousCommissionAgg._sum.platformCommission) + decimalToNumber(previousSubscriptionAgg._sum.amount);

  const newCompaniesThisMonth = companyRows.filter((company) => company.createdAt >= startOfMonth(new Date())).length;
  const activeCompanies = companyRows.filter((company) => company.lastActiveAt && (!window.from || company.lastActiveAt >= window.from)).length;

  const activityFeed: ActivityFeedItem[] = [
    ...recentSuccessfulPayments.map((payment) => ({
      id: `payment-${payment.id}`,
      timestamp: payment.paidAt ?? payment.createdAt,
      type: "payment_completed" as const,
      companyId: payment.companyId,
      companyName: payment.company?.name ?? "Unknown company",
      title: "Payment completed",
      summary: payment.providerReference,
      amount: decimalToNumber(payment.amount),
      amountLabel: formatCurrency(decimalToNumber(payment.amount), payment.currency),
      accent: "positive" as const,
    })),
    ...recentPaymentRequests.map((request) => ({
      id: `payment-request-${request.id}`,
      timestamp: request.sentAt ?? request.createdAt,
      type: "payment_request_sent" as const,
      companyId: request.companyId,
      companyName: request.company?.name ?? "Unknown company",
      title: "Payment request sent",
      summary: `${request.title}  -  ${request.status.toLowerCase()}`,
      amount: decimalToNumber(request.amount),
      amountLabel: formatCurrency(decimalToNumber(request.amount), request.currency),
      accent: request.status === "PAID" ? ("positive" as const) : ("neutral" as const),
    })),
    ...recentBillingEvents.map((event) => ({
      id: `billing-${event.id}`,
      timestamp: event.createdAt,
      type: "subscription_revenue" as const,
      companyId: event.companyId,
      companyName: event.company?.name ?? "Platform",
      title: "Subscription revenue recorded",
      summary: event.summary,
      amount: decimalToNumber(event.amount),
      amountLabel: event.amount ? formatCurrency(decimalToNumber(event.amount), event.currency ?? "NGN") : null,
      accent: "positive" as const,
    })),
    ...recentCompanyActivity.map((event) => ({
      id: `activity-${event.id}`,
      timestamp: event.createdAt,
      type:
        event.eventName === "payment.overdue_detected"
          ? ("overdue_detected" as const)
          : event.eventName === "company.created"
            ? ("company_created" as const)
            : ("company_onboarded" as const),
      companyId: event.companyId,
      companyName: event.company?.name ?? "Unknown company",
      title:
        event.eventName === "payment.overdue_detected"
          ? "Overdue payment detected"
          : event.eventName === "company.suspended"
            ? "Company suspended"
            : event.eventName === "company.reactivated"
              ? "Company reactivated"
              : event.eventName === "company.created"
                ? "Company created"
                : "Company became active",
      summary: event.summary,
      amount: null,
      amountLabel: null,
      accent:
        event.eventName === "payment.overdue_detected" || event.eventName === "company.suspended"
          ? ("alert" as const)
          : ("positive" as const),
    })),
    ...companyRows.slice(0, 10).map((company) => ({
      id: `company-created-${company.companyId}`,
      timestamp: company.createdAt,
      type: "company_created" as const,
      companyId: company.companyId,
      companyName: company.companyName,
      title: "Company created",
      summary: `${company.companyName} joined the platform`,
      amount: null,
      amountLabel: null,
      accent: "neutral" as const,
    })),
    ...recentWebhookIssues.map((event) => ({
      id: `webhook-${event.id}`,
      timestamp: event.createdAt,
      type: "webhook_alert" as const,
      companyId: event.companyId,
      companyName: event.company?.name ?? "Unknown company",
      title: "Webhook verification issue",
      summary: `${event.provider}: ${event.eventType}`,
      amount: null,
      amountLabel: null,
      accent: "alert" as const,
    })),
    ...recentJobFailures.map((event) => ({
      id: `job-${event.id}`,
      timestamp: event.createdAt,
      type: "job_failure" as const,
      companyId: event.companyId,
      companyName: event.company?.name ?? "Platform",
      title: "Automation issue",
      summary: `${event.jobName}${event.error ? `  -  ${event.error}` : ""}`,
      amount: null,
      amountLabel: null,
      accent: "alert" as const,
    })),
  ]
    .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime())
    .slice(0, SUPERADMIN_ACTIVITY_FEED_LIMIT);

  const trendSeries = platformReport.trendSeries.map((item) => ({
    label: item.label,
    inflow: item.inflow,
    platformRevenue: item.platformRevenue,
    subscriptionRevenue: item.subscriptionRevenue,
    commissionRevenue: item.commissionRevenue,
    signups: item.newCompanies,
    overdueExposure: item.overdueAmount,
  }));

  return {
    generatedAt: new Date(),
    range: window,
    companies: companyRows,
    overview: {
      totalCompanies: companyRows.length,
      activeCompanies,
      newCompaniesThisMonth,
      totalPlatformInflow,
      subscriptionRevenue,
      commissionRevenue,
      totalPlatformRevenue,
      totalSuccessfulPayments,
      overdueAmount,
      totalDeals,
      inflowTrend: formatPercentChange(totalPlatformInflow, previousPlatformInflow),
      revenueTrend: formatPercentChange(totalPlatformRevenue, previousPlatformRevenue),
    },
    recentActivity: activityFeed,
    plans: plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      interval: plan.interval,
      priceAmount: decimalToNumber(plan.priceAmount),
      currency: plan.currency,
      subscriberCount: plan._count.subscriptions,
      isActive: plan.isActive,
    })),
    trendSeries,
    controls: {
      missingPayoutSetup: companyRows.filter((company) => company.providerReadinessLabel !== "Payout ready").length,
      inactiveCompanies: companyRows.filter((company) => company.health === "inactive").length,
      collectionsRiskCompanies: companyRows.filter((company) => company.health === "collections_risk").length,
      recentWebhookIssues: recentWebhookIssues.map((item) => ({
        id: item.id,
        companyName: item.company?.name ?? "Unknown company",
        eventType: item.eventType,
        createdAt: formatDate(item.createdAt, "PPP p"),
        provider: item.provider,
      })),
      recentJobFailures: recentJobFailures.map((item) => ({
        id: item.id,
        companyName: item.company?.name ?? "Platform",
        jobName: item.jobName,
        error: item.error ?? "No error payload captured",
        createdAt: formatDate(item.createdAt, "PPP p"),
      })),
    },
  };
}

export async function getSuperadminOverviewData(range: SuperadminRange) {
  const analytics = await loadPlatformAnalyticsForRoute(range, "/superadmin", "SuperadminDashboardPage");

  const topRevenueCompanies = [...analytics.companies]
    .sort((left, right) => right.platformRevenue - left.platformRevenue)
    .slice(0, 5);
  const riskCompanies = analytics.companies
    .filter((company) => company.health === "collections_risk" || company.health === "inactive")
    .sort((left, right) => right.overdueAmount - left.overdueAmount || left.lastActiveLabel.localeCompare(right.lastActiveLabel))
    .slice(0, 5);

  return {
    generatedAt: analytics.generatedAt,
    range: analytics.range,
    metrics: [
      {
        label: "Total companies",
        value: String(analytics.overview.totalCompanies),
        detail: `${analytics.overview.activeCompanies} active in ${analytics.range.label.toLowerCase()}`,
      },
      {
        label: "New companies this month",
        value: String(analytics.overview.newCompaniesThisMonth),
        detail: "Fresh logo momentum on the platform",
      },
      {
        label: "Platform inflow",
        value: formatCurrency(analytics.overview.totalPlatformInflow),
        detail: analytics.overview.inflowTrend,
      },
      {
        label: "EstateOS revenue",
        value: formatCurrency(analytics.overview.totalPlatformRevenue),
        detail: analytics.overview.revenueTrend,
      },
      {
        label: "Subscription revenue",
        value: formatCurrency(analytics.overview.subscriptionRevenue),
        detail: "What EstateOS earned from plans",
      },
      {
        label: "Commission revenue",
        value: formatCurrency(analytics.overview.commissionRevenue),
        detail: "What EstateOS earned from successful payments",
      },
      {
        label: "Successful payments",
        value: String(analytics.overview.totalSuccessfulPayments),
        detail: `${analytics.range.label} completed payment count`,
      },
      {
        label: "Platform overdue",
        value: formatCurrency(analytics.overview.overdueAmount),
        detail: "Outstanding collections risk across all companies",
      },
      {
        label: "Deals on platform",
        value: String(analytics.overview.totalDeals),
        detail: "All active revenue records across tenants",
      },
    ],
    topRevenueCompanies,
    riskCompanies,
    actionBuckets: {
      missingPayoutSetup: analytics.controls.missingPayoutSetup,
      inactiveCompanies: analytics.controls.inactiveCompanies,
      collectionsRiskCompanies: analytics.controls.collectionsRiskCompanies,
    },
    recentActivity: analytics.recentActivity.slice(0, 12),
    generatedAtLabel: formatDate(analytics.generatedAt, "PPP p"),
  };
}

export async function getSuperadminRevenueData(range: SuperadminRange) {
  const analytics = await loadPlatformAnalyticsForRoute(range, "/superadmin/revenue", "SuperadminRevenuePage");
  const companies = [...analytics.companies].sort((left, right) => right.platformRevenue - left.platformRevenue);

  return {
    generatedAt: analytics.generatedAt,
    range: analytics.range,
    summary: {
      totalPlatformRevenue: analytics.overview.totalPlatformRevenue,
      subscriptionRevenue: analytics.overview.subscriptionRevenue,
      commissionRevenue: analytics.overview.commissionRevenue,
      totalPlatformInflow: analytics.overview.totalPlatformInflow,
      averageRevenuePerCompany:
        analytics.companies.length > 0
          ? analytics.overview.totalPlatformRevenue / analytics.companies.length
          : 0,
    },
    topRevenueCompanies: companies.slice(0, 6),
    trendSeries: analytics.trendSeries,
    companyBreakdown: companies.slice(0, 12),
    generatedAtLabel: formatDate(analytics.generatedAt, "PPP p"),
  };
}

export async function getSuperadminCompaniesData(input: {
  range: SuperadminRange;
  search?: string | null;
  health?: string | null;
  filter?: string | null;
  sort?: CompanySort;
}) {
  const analytics = await loadPlatformAnalyticsForRoute(input.range, "/superadmin/companies", "SuperadminCompaniesPage");
  const searchValue = typeof input.search === "string" ? input.search.trim().toLowerCase() : "";
  const healthFilter = parseCompanyHealthFilter(input.health);
  const quickFilter = parseCompanyQuickFilter(input.filter);

  let rows = [...analytics.companies];

  if (searchValue) {
    rows = rows.filter((row) =>
      [row.companyName, row.companySlug, row.subscriptionPlan, row.publicDomain]
        .join(" ")
        .toLowerCase()
        .includes(searchValue),
    );
  }

  if (healthFilter !== "all") {
    rows = rows.filter((row) => row.health === healthFilter);
  }

  if (quickFilter === "inactive") {
    rows = rows.filter((row) => row.health === "inactive");
  } else if (quickFilter === "collections-risk") {
    rows = rows.filter((row) => row.health === "collections_risk");
  } else if (quickFilter === "payout-missing") {
    rows = rows.filter((row) => row.providerReadinessLabel !== "Payout ready");
  }

  const sort = parseCompanySort(input.sort);
  rows.sort((left, right) => {
    if (sort === "highest_overdue") {
      return right.overdueAmount - left.overdueAmount || right.platformRevenue - left.platformRevenue;
    }

    if (sort === "newest") {
      return right.createdAt.getTime() - left.createdAt.getTime();
    }

    if (sort === "most_active") {
      return (right.lastActiveAt?.getTime() ?? 0) - (left.lastActiveAt?.getTime() ?? 0);
    }

    if (sort === "highest_inflow") {
      return right.inflowProcessed - left.inflowProcessed || right.platformRevenue - left.platformRevenue;
    }

    return right.platformRevenue - left.platformRevenue || right.inflowProcessed - left.inflowProcessed;
  });

  return {
    generatedAt: analytics.generatedAt,
    range: analytics.range,
    rows: limitSuperadminRows(rows, SUPERADMIN_COMPANY_TABLE_LIMIT),
    totalMatchingRows: rows.length,
    activeFilter: quickFilter,
    healthCounts: {
      healthy: analytics.companies.filter((company) => company.health === "healthy").length,
      collectionsRisk: analytics.companies.filter((company) => company.health === "collections_risk").length,
      inactive: analytics.companies.filter((company) => company.health === "inactive").length,
      onboardingIncomplete: analytics.companies.filter((company) => company.health === "onboarding_incomplete").length,
      highValue: analytics.companies.filter((company) => company.health === "high_value").length,
    },
    generatedAtLabel: formatDate(analytics.generatedAt, "PPP p"),
  };
}

export async function getSuperadminCompanyOverview(companyId: string, range: SuperadminRange = "30d") {
  const analytics = await loadPlatformAnalyticsForRoute(
    range,
    `/superadmin/companies/${companyId}`,
    "SuperadminCompanyOverviewPage",
  );
  let company = analytics.companies.find((entry) => entry.companyId === companyId);

  if (!company && featureFlags.hasDatabase) {
    const fallback = await runSuperadminOverviewQuery("companyDetail.companyFallback", null, () =>
      prisma.company.findUnique({
        where: { id: companyId },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          suspendedAt: true,
          suspensionReason: true,
          customDomain: true,
          subdomain: true,
          createdAt: true,
        },
      }), {
        route: `/superadmin/companies/${companyId}`,
        component: "SuperadminCompanyOverviewPage",
      });
    company = fallback ? buildEmptyCompanyMetricRow(fallback) : undefined;
  }

  if (!company || !featureFlags.hasDatabase) {
    throw new Error("Company not found.");
  }

  const [transactions, paymentRequests, payments, billingEvents, activityEvents, providerAccounts, subscriptions] =
    await Promise.all([
      runSuperadminOverviewQuery("companyDetail.transactions", [], () => prisma.transaction.findMany({
        where: { companyId },
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: {
          id: true,
          totalValue: true,
          outstandingBalance: true,
          paymentStatus: true,
          currentStage: true,
          followUpStatus: true,
          lastFollowedUpAt: true,
          nextFollowUpAt: true,
          property: { select: { title: true } },
          user: { select: { firstName: true, lastName: true, email: true } },
          updatedAt: true,
        },
      }), { route: `/superadmin/companies/${companyId}`, component: "SuperadminCompanyOverviewPage" }),
      runSuperadminOverviewQuery("companyDetail.paymentRequests", [], () => prisma.paymentRequest.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          title: true,
          status: true,
          amount: true,
          currency: true,
          dueAt: true,
          sentAt: true,
          createdAt: true,
        },
      }), { route: `/superadmin/companies/${companyId}`, component: "SuperadminCompanyOverviewPage" }),
      runSuperadminOverviewQuery("companyDetail.payments", [], () => prisma.payment.findMany({
        where: { companyId, status: "SUCCESS" },
        orderBy: { paidAt: "desc" },
        take: 12,
        select: {
          id: true,
          providerReference: true,
          amount: true,
          currency: true,
          paidAt: true,
          method: true,
        },
      }), { route: `/superadmin/companies/${companyId}`, component: "SuperadminCompanyOverviewPage" }),
      runSuperadminOverviewQuery("companyDetail.billingEvents", [], () => prisma.billingEvent.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          type: true,
          summary: true,
          amount: true,
          currency: true,
          createdAt: true,
        },
      }), { route: `/superadmin/companies/${companyId}`, component: "SuperadminCompanyOverviewPage" }),
      runSuperadminOverviewQuery("companyDetail.activityEvents", [], () => prisma.activityEvent.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          eventName: true,
          summary: true,
          createdAt: true,
        },
      }), { route: `/superadmin/companies/${companyId}`, component: "SuperadminCompanyOverviewPage" }),
      runSuperadminOverviewQuery("companyDetail.providerAccounts", [], () => prisma.companyPaymentProviderAccount.findMany({
        where: { companyId },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          provider: true,
          displayName: true,
          status: true,
          supportsTransactionSplit: true,
          supportsSubscriptions: true,
          isDefaultPayout: true,
          updatedAt: true,
        },
      }), { route: `/superadmin/companies/${companyId}`, component: "SuperadminCompanyOverviewPage" }),
      runSuperadminOverviewQuery("companyDetail.subscriptions", [], () => prisma.companySubscription.findMany({
        where: { companyId },
        orderBy: { startsAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          interval: true,
          startsAt: true,
          endsAt: true,
          plan: {
            select: {
              name: true,
            },
          },
        },
      }), { route: `/superadmin/companies/${companyId}`, component: "SuperadminCompanyOverviewPage" }),
    ]);

  const paidDeals = transactions.filter((item) => item.paymentStatus === "COMPLETED").length;
  const reservationToPayment =
    company.totalDeals > 0 ? `${Math.round((paidDeals / Math.max(company.totalDeals, 1)) * 100)}%` : "N/A";

  return {
    company,
    range: analytics.range,
    generatedAtLabel: formatDate(analytics.generatedAt, "PPP p"),
    businessMetrics: {
      totalDeals: company.totalDeals,
      totalPaymentRequests: paymentRequests.length,
      totalPaymentsCompleted: company.successfulPayments,
      totalOverdue: company.overdueAmount,
      collectionsPerformance:
        company.overdueAmount > 0 ? `${formatCurrency(company.overdueAmount)} overdue` : "No overdue exposure",
      inquiryToReservation: company.totalDeals > 0 ? "Tracked in core workflow" : "No deals yet",
      reservationToPayment,
    },
    platformMetrics: {
      estateRevenue: company.platformRevenue,
      subscriptionStatus: company.subscriptionStatus,
      subscriptionPlan: company.planLabel,
      commissionRule: company.commissionRuleLabel,
      payoutReadiness: company.providerReadinessLabel,
      billingProvider: company.billingProvider,
    },
    recentTransactions: transactions.map((item) => ({
      id: item.id,
      buyerName:
        [item.user?.firstName, item.user?.lastName].filter(Boolean).join(" ") || item.user?.email || "Unnamed buyer",
      propertyTitle: item.property?.title ?? "Property unavailable",
      totalValue: formatCurrency(decimalToNumber(item.totalValue), company.defaultCurrency),
      outstanding: formatCurrency(decimalToNumber(item.outstandingBalance), company.defaultCurrency),
      paymentStatus: item.paymentStatus,
      stage: item.currentStage,
      followUpStatus: item.followUpStatus,
      nextAction:
        item.paymentStatus === "OVERDUE"
          ? item.nextFollowUpAt
            ? `Next follow-up ${formatDate(item.nextFollowUpAt, "PPP")}`
            : "Collections follow-up needed"
          : `Updated ${formatDate(item.updatedAt, "PPP")}`,
      updatedAt: formatDate(item.updatedAt, "PPP p"),
    })),
    recentPaymentRequests: paymentRequests.map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      amount: formatCurrency(decimalToNumber(item.amount), item.currency),
      dueAt: item.dueAt ? formatDate(item.dueAt, "PPP") : "No due date",
      sentAt: item.sentAt ? formatDate(item.sentAt, "PPP p") : formatDate(item.createdAt, "PPP p"),
    })),
    recentPayments: payments.map((item) => ({
      id: item.id,
      reference: item.providerReference,
      amount: formatCurrency(decimalToNumber(item.amount), item.currency),
      paidAt: item.paidAt ? formatDate(item.paidAt, "PPP p") : "Pending",
      method: item.method,
    })),
    recentActivity: activityEvents.map((item) => ({
      id: item.id,
      title: item.eventName,
      summary: item.summary,
      timestamp: item.createdAt,
      createdAt: formatDate(item.createdAt, "PPP p"),
    })),
    recentBilling: billingEvents.map((item) => ({
      id: item.id,
      type: item.type,
      summary: item.summary,
      amount: item.amount ? formatCurrency(decimalToNumber(item.amount), item.currency ?? company.defaultCurrency) : null,
      createdAt: formatDate(item.createdAt, "PPP p"),
    })),
    providerAccounts: providerAccounts.map((item) => ({
      id: item.id,
      name: item.displayName,
      provider: item.provider,
      status: item.status,
      splitReady: item.supportsTransactionSplit ? "Enabled" : "Disabled",
      updatedAt: formatDate(item.updatedAt, "PPP p"),
      isDefault: item.isDefaultPayout,
    })),
    subscriptions: subscriptions.map((item) => ({
      id: item.id,
      label: `${item.plan?.name ?? "Plan unavailable"} ${item.interval.toLowerCase()}`,
      status: item.status,
      startsAt: formatDate(item.startsAt, "PPP"),
      endsAt: item.endsAt ? formatDate(item.endsAt, "PPP") : "Open-ended",
    })),
  };
}

function buildSuperadminActivityData(analytics: ReturnType<typeof buildEmptyPlatformAnalytics>) {
  return {
    generatedAtLabel: formatDate(analytics.generatedAt, "PPP p"),
    range: analytics.range,
    items: analytics.recentActivity,
    counts: {
      payments: analytics.recentActivity.filter((item) => item.type === "payment_completed").length,
      paymentRequests: analytics.recentActivity.filter((item) => item.type === "payment_request_sent").length,
      onboarding: analytics.recentActivity.filter(
        (item) => item.type === "company_created" || item.type === "company_onboarded",
      ).length,
      risk: analytics.recentActivity.filter(
        (item) => item.type === "overdue_detected" || item.type === "webhook_alert" || item.type === "job_failure",
      ).length,
    },
  };
}

function buildSuperadminControlsData(analytics: ReturnType<typeof buildEmptyPlatformAnalytics>) {
  return {
    generatedAtLabel: formatDate(analytics.generatedAt, "PPP p"),
    controls: analytics.controls,
    plans: analytics.plans,
    companiesNeedingAttention: analytics.companies
      .filter((company) => company.providerReadinessLabel !== "Payout ready" || company.health === "collections_risk")
      .sort((left, right) => right.overdueAmount - left.overdueAmount)
      .slice(0, 10),
  };
}

export function buildEmptySuperadminActivityData(range: SuperadminRange = "30d") {
  return buildSuperadminActivityData(buildEmptyPlatformAnalytics(range));
}

export function buildEmptySuperadminControlsData() {
  return buildSuperadminControlsData(buildEmptyPlatformAnalytics("30d"));
}

export async function getSuperadminActivityData(range: SuperadminRange) {
  const analytics = await loadPlatformAnalyticsForRoute(range, "/superadmin/activity", "SuperadminActivityPage");
  return buildSuperadminActivityData(analytics);
}

export async function getSuperadminControlsData() {
  const analytics = await loadPlatformAnalyticsForRoute("30d", "/superadmin/settings", "SuperadminSettingsPage");
  return buildSuperadminControlsData(analytics);
}

export async function getSuperadminDashboardData(range: SuperadminRange = "30d") {
  return getSuperadminOverviewData(range);
}
