import { Prisma } from "@prisma/client";
import { endOfDay, endOfMonth, endOfWeek, format, startOfDay, startOfMonth, startOfWeek, subDays } from "date-fns";

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import type { TenantContext } from "@/lib/tenancy/context";
import { formatCurrency } from "@/lib/utils";

type Decimalish = Prisma.Decimal | { toNumber?: () => number } | number | null | undefined;

export type AnalyticsRange = "7d" | "30d" | "90d" | "all";
export type AnalyticsBucket = "day" | "week" | "month";

type TrendAccumulator = {
  bucketDate: Date;
  label: string;
  inflow: number;
  platformRevenue: number;
  subscriptionRevenue: number;
  commissionRevenue: number;
  overdueAmount: number;
  totalDeals: number;
  successfulPayments: number;
  newCompanies: number;
  inquiries: number;
  reservations: number;
  paymentRequests: number;
  overdueCount: number;
  activeCompanies: number;
  collected: number;
};

type SnapshotRow = {
  bucketDate: Date;
  totalCompanies: Decimalish;
  activeCompanies: Decimalish;
  newCompanies: Decimalish;
  inquiryCount: Decimalish;
  reservationCount: Decimalish;
  dealCount: Decimalish;
  paymentRequestCount: Decimalish;
  successfulPaymentCount: Decimalish;
  overdueCount: Decimalish;
  platformInflow: Decimalish;
  subscriptionRevenue: Decimalish;
  commissionRevenue: Decimalish;
  platformRevenue: Decimalish;
  overdueAmount: Decimalish;
};

function decimalToNumber(value: Decimalish) {
  if (value == null) {
    return 0;
  }

  return typeof value === "number" ? value : value.toNumber?.() ?? Number(value);
}

function roundToTwo(value: number) {
  return Number(value.toFixed(2));
}

function getBucketForRange(range: AnalyticsRange): AnalyticsBucket {
  if (range === "7d" || range === "30d") {
    return "day";
  }

  if (range === "90d") {
    return "week";
  }

  return "month";
}

function getRangeWindow(range: AnalyticsRange, now = new Date()) {
  if (range === "7d") {
    return {
      range,
      bucket: "day" as const,
      from: startOfDay(subDays(now, 6)),
      to: endOfDay(now),
    };
  }

  if (range === "30d") {
    return {
      range,
      bucket: "day" as const,
      from: startOfDay(subDays(now, 29)),
      to: endOfDay(now),
    };
  }

  if (range === "90d") {
    return {
      range,
      bucket: "week" as const,
      from: startOfWeek(subDays(now, 89)),
      to: endOfWeek(now),
    };
  }

  return {
    range,
    bucket: "month" as const,
    from: null,
    to: endOfMonth(now),
  };
}

function bucketStartForDate(value: Date, bucket: AnalyticsBucket) {
  if (bucket === "day") {
    return startOfDay(value);
  }

  if (bucket === "week") {
    return startOfWeek(value);
  }

  return startOfMonth(value);
}

function bucketLabel(value: Date, bucket: AnalyticsBucket) {
  if (bucket === "day") {
    return format(value, "MMM d");
  }

  if (bucket === "week") {
    return `Week of ${format(value, "MMM d")}`;
  }

  return format(value, "MMM yyyy");
}

function buildBucketSeed(range: AnalyticsRange, now = new Date()) {
  const { from, to, bucket } = getRangeWindow(range, now);
  const buckets: TrendAccumulator[] = [];

  if (!from) {
    return buckets;
  }

  let cursor = bucketStartForDate(from, bucket);
  const finalDate = bucketStartForDate(to, bucket);

  while (cursor.getTime() <= finalDate.getTime()) {
    buckets.push({
      bucketDate: cursor,
      label: bucketLabel(cursor, bucket),
      inflow: 0,
      platformRevenue: 0,
      subscriptionRevenue: 0,
      commissionRevenue: 0,
      overdueAmount: 0,
      totalDeals: 0,
      successfulPayments: 0,
      newCompanies: 0,
      inquiries: 0,
      reservations: 0,
      paymentRequests: 0,
      overdueCount: 0,
      activeCompanies: 0,
      collected: 0,
    });

    cursor =
      bucket === "day"
        ? startOfDay(new Date(cursor.getTime() + 24 * 60 * 60 * 1000))
        : bucket === "week"
          ? startOfWeek(new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000))
          : startOfMonth(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  }

  return buckets;
}

function buildBucketMap(range: AnalyticsRange, now = new Date()) {
  const bucket = getBucketForRange(range);
  const seed = buildBucketSeed(range, now);
  const map = new Map(seed.map((item) => [bucketStartForDate(item.bucketDate, bucket).toISOString(), item]));
  return { bucket, seed, map };
}

export function calculateConversionRate(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }

  return roundToTwo((numerator / denominator) * 100);
}

export function calculateRecoveryRate(recoveredAmount: number, currentOverdueAmount: number) {
  const denominator = recoveredAmount + currentOverdueAmount;
  if (denominator <= 0) {
    return 0;
  }

  return roundToTwo((recoveredAmount / denominator) * 100);
}

function average(input: number[]) {
  if (input.length < 1) {
    return 0;
  }

  return roundToTwo(input.reduce((sum, value) => sum + value, 0) / input.length);
}

function normalizeSnapshotRows(rows: SnapshotRow[], range: AnalyticsRange) {
  const { bucket, seed, map } = buildBucketMap(range);

  for (const row of rows) {
    const key = bucketStartForDate(row.bucketDate, bucket).toISOString();
    const target = map.get(key);
    if (!target) {
      continue;
    }

    target.newCompanies += decimalToNumber(row.newCompanies);
    target.inquiries += decimalToNumber(row.inquiryCount);
    target.reservations += decimalToNumber(row.reservationCount);
    target.totalDeals += decimalToNumber(row.dealCount);
    target.paymentRequests += decimalToNumber(row.paymentRequestCount);
    target.successfulPayments += decimalToNumber(row.successfulPaymentCount);
    target.inflow += decimalToNumber(row.platformInflow);
    target.collected += decimalToNumber(row.platformInflow);
    target.subscriptionRevenue += decimalToNumber(row.subscriptionRevenue);
    target.commissionRevenue += decimalToNumber(row.commissionRevenue);
    target.platformRevenue += decimalToNumber(row.platformRevenue);
    target.overdueAmount = Math.max(target.overdueAmount, decimalToNumber(row.overdueAmount));
    target.overdueCount = Math.max(target.overdueCount, decimalToNumber(row.overdueCount));
    target.activeCompanies = Math.max(target.activeCompanies, decimalToNumber(row.activeCompanies));
  }

  return seed;
}

function buildAnalyticsMetadata(input: {
  inquiryCount: number;
  reservationCount: number;
  successfulPaymentCount: number;
  overdueRecoveredAmount: number;
  overdueAmount: number;
  avgDaysToCollect: number;
}) {
  return {
    inquiryToReservationConversion: calculateConversionRate(input.reservationCount, input.inquiryCount),
    reservationToPaymentConversion: calculateConversionRate(
      input.successfulPaymentCount,
      input.reservationCount,
    ),
    overdueRecoveredPercent: calculateRecoveryRate(
      input.overdueRecoveredAmount,
      input.overdueAmount,
    ),
    avgDaysToCollect: input.avgDaysToCollect,
  } satisfies Prisma.JsonObject;
}

const paymentTimelineArgs = Prisma.validator<Prisma.PaymentFindManyArgs>()({
  select: {
    paidAt: true,
    transaction: {
      select: {
        reservation: {
          select: {
            createdAt: true,
          },
        },
      },
    },
  },
});

async function buildPlatformDailySnapshot(now = new Date()) {
  const bucketDate = startOfDay(now);
  const dayWhere = {
    gte: bucketDate,
    lt: startOfDay(new Date(bucketDate.getTime() + 24 * 60 * 60 * 1000)),
  };

  const [
    totalCompanies,
    activeCompanies,
    newCompanies,
    inquiryCount,
    reservationCount,
    dealCount,
    paymentRequestCount,
    successfulPaymentCount,
    paymentsAgg,
    subscriptionAgg,
    commissionAgg,
    overdueAgg,
    activeByRecentActivity,
  ] = await Promise.all([
    prisma.company.count(),
    prisma.company.count({ where: { status: "ACTIVE" } }),
    prisma.company.count({ where: { createdAt: dayWhere } }),
    prisma.inquiry.count({ where: { createdAt: dayWhere } }),
    prisma.reservation.count({ where: { createdAt: dayWhere } }),
    prisma.transaction.count({ where: { createdAt: dayWhere } }),
    prisma.paymentRequest.count({
      where: {
        OR: [{ sentAt: dayWhere }, { createdAt: dayWhere }],
      },
    }),
    prisma.payment.count({
      where: {
        status: "SUCCESS",
        paidAt: dayWhere,
      },
    }),
    prisma.payment.aggregate({
      where: {
        status: "SUCCESS",
        paidAt: dayWhere,
      },
      _sum: { amount: true },
    }),
    prisma.billingEvent.aggregate({
      where: {
        type: "SUBSCRIPTION_PAYMENT_RECORDED",
        createdAt: dayWhere,
      },
      _sum: { amount: true },
    }),
    prisma.commissionRecord.aggregate({
      where: { createdAt: dayWhere },
      _sum: { platformCommission: true },
    }),
    prisma.transaction.aggregate({
      where: { paymentStatus: "OVERDUE" },
      _sum: { outstandingBalance: true },
      _count: { id: true },
    }),
    prisma.activityEvent.groupBy({
      by: ["companyId"],
      where: { createdAt: dayWhere },
      _count: { _all: true },
    }),
  ]);

  const platformInflow = decimalToNumber(paymentsAgg._sum.amount);
  const subscriptionRevenue = decimalToNumber(subscriptionAgg._sum.amount);
  const commissionRevenue = decimalToNumber(commissionAgg._sum.platformCommission);
  const overdueAmount = decimalToNumber(overdueAgg._sum.outstandingBalance);

  return {
    scope: "PLATFORM" as const,
    scopeKey: "platform",
    bucketDate,
    totalCompanies,
    activeCompanies: Math.max(activeByRecentActivity.length, activeCompanies),
    newCompanies,
    inquiryCount,
    reservationCount,
    dealCount,
    paymentRequestCount,
    successfulPaymentCount,
    overdueCount: overdueAgg._count.id,
    platformInflow,
    subscriptionRevenue,
    commissionRevenue,
    platformRevenue: subscriptionRevenue + commissionRevenue,
    overdueAmount,
    totalOutstandingAmount: overdueAmount,
    overdueRecoveredAmount: 0,
    avgDaysToCollect: 0,
    metadata: buildAnalyticsMetadata({
      inquiryCount,
      reservationCount,
      successfulPaymentCount,
      overdueRecoveredAmount: 0,
      overdueAmount,
      avgDaysToCollect: 0,
    }),
  };
}

async function buildCompanyDailySnapshots(input?: { companyId?: string; now?: Date }) {
  const now = input?.now ?? new Date();
  const bucketDate = startOfDay(now);
  const dayWhere = {
    gte: bucketDate,
    lt: startOfDay(new Date(bucketDate.getTime() + 24 * 60 * 60 * 1000)),
  };

  const companies = await prisma.company.findMany({
    where: input?.companyId ? { id: input.companyId } : undefined,
    select: { id: true, status: true },
  });

  return Promise.all(
    companies.map(async (company) => {
      const [
        inquiryCount,
        reservationCount,
        dealCount,
        paymentRequestCount,
        successfulPaymentCount,
        paymentAgg,
        overdueAgg,
        totalOutstandingAgg,
        subscriptionAgg,
        commissionAgg,
        paidTransactions,
        reservationTimeline,
      ] = await Promise.all([
        prisma.inquiry.count({ where: { companyId: company.id, createdAt: dayWhere } }),
        prisma.reservation.count({ where: { companyId: company.id, createdAt: dayWhere } }),
        prisma.transaction.count({ where: { companyId: company.id, createdAt: dayWhere } }),
        prisma.paymentRequest.count({
          where: {
            companyId: company.id,
            OR: [{ sentAt: dayWhere }, { createdAt: dayWhere }],
          },
        }),
        prisma.payment.count({
          where: {
            companyId: company.id,
            status: "SUCCESS",
            paidAt: dayWhere,
          },
        }),
        prisma.payment.aggregate({
          where: {
            companyId: company.id,
            status: "SUCCESS",
            paidAt: dayWhere,
          },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { companyId: company.id, paymentStatus: "OVERDUE" },
          _sum: { outstandingBalance: true },
          _count: { id: true },
        }),
        prisma.transaction.aggregate({
          where: { companyId: company.id, outstandingBalance: { gt: 0 } },
          _sum: { outstandingBalance: true },
        }),
        prisma.billingEvent.aggregate({
          where: {
            companyId: company.id,
            type: "SUBSCRIPTION_PAYMENT_RECORDED",
            createdAt: dayWhere,
          },
          _sum: { amount: true },
        }),
        prisma.commissionRecord.aggregate({
          where: { companyId: company.id, createdAt: dayWhere },
          _sum: { platformCommission: true },
        }),
        prisma.payment.findMany({
          where: {
            companyId: company.id,
            status: "SUCCESS",
            paidAt: dayWhere,
            transaction: {
              paymentStatus: { in: ["COMPLETED", "PARTIAL"] },
              lastPaymentReminderAt: { not: null },
            },
          },
          select: { amount: true },
        }),
        prisma.payment.findMany({
          where: {
            companyId: company.id,
            status: "SUCCESS",
            paidAt: {
              not: null,
              gte: dayWhere.gte,
              lt: dayWhere.lt,
            },
            transactionId: { not: null },
          },
          ...paymentTimelineArgs,
        }),
      ]);

      const platformInflow = decimalToNumber(paymentAgg._sum.amount);
      const subscriptionRevenue = decimalToNumber(subscriptionAgg._sum.amount);
      const commissionRevenue = decimalToNumber(commissionAgg._sum.platformCommission);
      const overdueAmount = decimalToNumber(overdueAgg._sum.outstandingBalance);
      const overdueRecoveredAmount = roundToTwo(
        paidTransactions.reduce((sum, payment) => sum + decimalToNumber(payment.amount), 0),
      );
      const avgDaysToCollect = average(
        reservationTimeline
          .map((payment) => {
            if (!payment.paidAt || !payment.transaction?.reservation?.createdAt) {
              return null;
            }

            return Math.max(
              0,
              (payment.paidAt.getTime() - payment.transaction.reservation.createdAt.getTime()) /
                (1000 * 60 * 60 * 24),
            );
          })
          .filter((value): value is number => value != null),
      );

      return {
        scope: "COMPANY" as const,
        scopeKey: company.id,
        companyId: company.id,
        bucketDate,
        totalCompanies: 1,
        activeCompanies: company.status === "ACTIVE" ? 1 : 0,
        newCompanies: 0,
        inquiryCount,
        reservationCount,
        dealCount,
        paymentRequestCount,
        successfulPaymentCount,
        overdueCount: overdueAgg._count.id,
        platformInflow,
        subscriptionRevenue,
        commissionRevenue,
        platformRevenue: subscriptionRevenue + commissionRevenue,
        overdueAmount,
        totalOutstandingAmount: decimalToNumber(totalOutstandingAgg._sum.outstandingBalance),
        overdueRecoveredAmount,
        avgDaysToCollect,
        companyStatus: company.status,
        metadata: buildAnalyticsMetadata({
          inquiryCount,
          reservationCount,
          successfulPaymentCount,
          overdueRecoveredAmount,
          overdueAmount,
          avgDaysToCollect,
        }),
      };
    }),
  );
}

export async function syncAnalyticsSnapshots(input?: { companyId?: string; now?: Date }) {
  if (!featureFlags.hasDatabase) {
    return { synced: 0 };
  }

  const [platformSnapshot, companySnapshots] = await Promise.all([
    buildPlatformDailySnapshot(input?.now),
    buildCompanyDailySnapshots(input),
  ]);

  const payloads = [platformSnapshot, ...companySnapshots];

  await Promise.all(
    payloads.map((payload) =>
      prisma.analyticsDailySnapshot.upsert({
        where: {
          scope_scopeKey_bucketDate: {
            scope: payload.scope,
            scopeKey: payload.scopeKey,
            bucketDate: payload.bucketDate,
          },
        },
        create: payload,
        update: payload,
      }),
    ),
  );

  return { synced: payloads.length };
}

async function loadPlatformSnapshotRows(range: AnalyticsRange) {
  const window = getRangeWindow(range);

  const rows = await prisma.analyticsDailySnapshot.findMany({
    where: {
      scope: "PLATFORM",
      ...(window.from
        ? {
            bucketDate: {
              gte: window.from,
              lte: window.to,
            },
          }
        : {}),
    },
    orderBy: { bucketDate: "asc" },
    select: {
      bucketDate: true,
      totalCompanies: true,
      activeCompanies: true,
      newCompanies: true,
      inquiryCount: true,
      reservationCount: true,
      dealCount: true,
      paymentRequestCount: true,
      successfulPaymentCount: true,
      overdueCount: true,
      platformInflow: true,
      subscriptionRevenue: true,
      commissionRevenue: true,
      platformRevenue: true,
      overdueAmount: true,
    },
  });

  return normalizeSnapshotRows(rows, range);
}

async function loadCompanySnapshotRows(companyId: string, range: AnalyticsRange) {
  const window = getRangeWindow(range);

  const rows = await prisma.analyticsDailySnapshot.findMany({
    where: {
      scope: "COMPANY",
      scopeKey: companyId,
      ...(window.from
        ? {
            bucketDate: {
              gte: window.from,
              lte: window.to,
            },
          }
        : {}),
    },
    orderBy: { bucketDate: "asc" },
    select: {
      bucketDate: true,
      totalCompanies: true,
      activeCompanies: true,
      newCompanies: true,
      inquiryCount: true,
      reservationCount: true,
      dealCount: true,
      paymentRequestCount: true,
      successfulPaymentCount: true,
      overdueCount: true,
      platformInflow: true,
      subscriptionRevenue: true,
      commissionRevenue: true,
      platformRevenue: true,
      overdueAmount: true,
    },
  });

  return normalizeSnapshotRows(rows, range);
}

async function buildPlatformTrendsFromSource(range: AnalyticsRange) {
  const window = getRangeWindow(range);
  const { bucket, seed, map } = buildBucketMap(range);

  const [
    payments,
    commissions,
    billings,
    companies,
    inquiries,
    reservations,
    paymentRequests,
    overdueTransactions,
  ] = await Promise.all([
    prisma.payment.findMany({
      where: {
        status: "SUCCESS",
        ...(window.from ? { paidAt: { gte: window.from, lte: window.to } } : {}),
      },
      select: { paidAt: true, amount: true },
    }),
    prisma.commissionRecord.findMany({
      where: window.from ? { createdAt: { gte: window.from, lte: window.to } } : undefined,
      select: { createdAt: true, platformCommission: true },
    }),
    prisma.billingEvent.findMany({
      where: {
        type: "SUBSCRIPTION_PAYMENT_RECORDED",
        ...(window.from ? { createdAt: { gte: window.from, lte: window.to } } : {}),
      },
      select: { createdAt: true, amount: true },
    }),
    prisma.company.findMany({
      where: window.from ? { createdAt: { gte: window.from, lte: window.to } } : undefined,
      select: { createdAt: true },
    }),
    prisma.inquiry.findMany({
      where: window.from ? { createdAt: { gte: window.from, lte: window.to } } : undefined,
      select: { createdAt: true },
    }),
    prisma.reservation.findMany({
      where: window.from ? { createdAt: { gte: window.from, lte: window.to } } : undefined,
      select: { createdAt: true },
    }),
    prisma.paymentRequest.findMany({
      where: window.from
        ? {
            OR: [
              { sentAt: { gte: window.from, lte: window.to } },
              { createdAt: { gte: window.from, lte: window.to } },
            ],
          }
        : undefined,
      select: { sentAt: true, createdAt: true },
    }),
    prisma.transaction.findMany({
      where: { paymentStatus: "OVERDUE" },
      select: { outstandingBalance: true },
    }),
  ]);

  const writeValue = (dateValue: Date | null | undefined, writer: (target: TrendAccumulator) => void) => {
    if (!dateValue) {
      return;
    }

    const target = map.get(bucketStartForDate(dateValue, bucket).toISOString());
    if (target) {
      writer(target);
    }
  };

  for (const payment of payments) {
    writeValue(payment.paidAt, (target) => {
      const amount = decimalToNumber(payment.amount);
      target.inflow += amount;
      target.collected += amount;
      target.successfulPayments += 1;
    });
  }

  for (const commission of commissions) {
    writeValue(commission.createdAt, (target) => {
      const amount = decimalToNumber(commission.platformCommission);
      target.commissionRevenue += amount;
      target.platformRevenue += amount;
    });
  }

  for (const billing of billings) {
    writeValue(billing.createdAt, (target) => {
      const amount = decimalToNumber(billing.amount);
      target.subscriptionRevenue += amount;
      target.platformRevenue += amount;
    });
  }

  for (const company of companies) {
    writeValue(company.createdAt, (target) => {
      target.newCompanies += 1;
    });
  }

  for (const inquiry of inquiries) {
    writeValue(inquiry.createdAt, (target) => {
      target.inquiries += 1;
    });
  }

  for (const reservation of reservations) {
    writeValue(reservation.createdAt, (target) => {
      target.reservations += 1;
    });
  }

  for (const request of paymentRequests) {
    writeValue(request.sentAt ?? request.createdAt, (target) => {
      target.paymentRequests += 1;
    });
  }

  const todayTarget = map.get(bucketStartForDate(new Date(), bucket).toISOString());
  if (todayTarget) {
    for (const item of overdueTransactions) {
      todayTarget.overdueAmount += decimalToNumber(item.outstandingBalance);
      todayTarget.overdueCount += 1;
    }
  }

  return seed;
}

async function buildCompanyTrendsFromSource(companyId: string, range: AnalyticsRange) {
  const window = getRangeWindow(range);
  const { bucket, seed, map } = buildBucketMap(range);

  const [payments, inquiries, reservations, paymentRequests, deals, overdueTransactions] = await Promise.all([
    prisma.payment.findMany({
      where: {
        companyId,
        status: "SUCCESS",
        ...(window.from ? { paidAt: { gte: window.from, lte: window.to } } : {}),
      },
      select: { paidAt: true, amount: true },
    }),
    prisma.inquiry.findMany({
      where: { companyId, ...(window.from ? { createdAt: { gte: window.from, lte: window.to } } : {}) },
      select: { createdAt: true },
    }),
    prisma.reservation.findMany({
      where: { companyId, ...(window.from ? { createdAt: { gte: window.from, lte: window.to } } : {}) },
      select: { createdAt: true },
    }),
    prisma.paymentRequest.findMany({
      where: {
        companyId,
        ...(window.from
          ? {
              OR: [
                { sentAt: { gte: window.from, lte: window.to } },
                { createdAt: { gte: window.from, lte: window.to } },
              ],
            }
          : {}),
      },
      select: { sentAt: true, createdAt: true },
    }),
    prisma.transaction.findMany({
      where: { companyId, ...(window.from ? { createdAt: { gte: window.from, lte: window.to } } : {}) },
      select: { createdAt: true },
    }),
    prisma.transaction.findMany({
      where: { companyId, paymentStatus: "OVERDUE" },
      select: { outstandingBalance: true },
    }),
  ]);

  const writeValue = (dateValue: Date | null | undefined, writer: (target: TrendAccumulator) => void) => {
    if (!dateValue) {
      return;
    }

    const target = map.get(bucketStartForDate(dateValue, bucket).toISOString());
    if (target) {
      writer(target);
    }
  };

  for (const payment of payments) {
    writeValue(payment.paidAt, (target) => {
      const amount = decimalToNumber(payment.amount);
      target.collected += amount;
      target.successfulPayments += 1;
      target.inflow += amount;
    });
  }

  for (const inquiry of inquiries) {
    writeValue(inquiry.createdAt, (target) => {
      target.inquiries += 1;
    });
  }

  for (const reservation of reservations) {
    writeValue(reservation.createdAt, (target) => {
      target.reservations += 1;
    });
  }

  for (const request of paymentRequests) {
    writeValue(request.sentAt ?? request.createdAt, (target) => {
      target.paymentRequests += 1;
    });
  }

  for (const deal of deals) {
    writeValue(deal.createdAt, (target) => {
      target.totalDeals += 1;
    });
  }

  const todayTarget = map.get(bucketStartForDate(new Date(), bucket).toISOString());
  if (todayTarget) {
    for (const item of overdueTransactions) {
      todayTarget.overdueAmount += decimalToNumber(item.outstandingBalance);
      todayTarget.overdueCount += 1;
    }
  }

  return seed;
}

async function loadLatestCompanySnapshot(companyId: string) {
  return prisma.analyticsDailySnapshot.findFirst({
    where: { scope: "COMPANY", scopeKey: companyId },
    orderBy: { bucketDate: "desc" },
    select: {
      bucketDate: true,
      overdueRecoveredAmount: true,
      avgDaysToCollect: true,
      metadata: true,
    },
  });
}

export async function getPlatformAnalyticsReport(range: AnalyticsRange = "30d") {
  if (!featureFlags.hasDatabase) {
    return {
      range,
      generatedAt: new Date(),
      summary: {
        totalPlatformInflow: 0,
        totalPlatformRevenue: 0,
        subscriptionRevenue: 0,
        commissionRevenue: 0,
        overdueAmount: 0,
        totalDeals: 0,
        successfulPayments: 0,
        totalCompanies: 0,
        activeCompanies: 0,
      },
      trendSeries: [] as TrendAccumulator[],
    };
  }

  const snapshotRows = await loadPlatformSnapshotRows(range);
  const trendSeries = snapshotRows.some((item) => item.inflow > 0 || item.platformRevenue > 0 || item.newCompanies > 0)
    ? snapshotRows
    : await buildPlatformTrendsFromSource(range);

  const totalCompanies = await prisma.company.count();
  const activeCompanies = await prisma.company.count({
    where: { status: "ACTIVE" },
  });

  return {
    range,
    generatedAt: new Date(),
    summary: {
      totalPlatformInflow: trendSeries.reduce((sum, item) => sum + item.inflow, 0),
      totalPlatformRevenue: trendSeries.reduce((sum, item) => sum + item.platformRevenue, 0),
      subscriptionRevenue: trendSeries.reduce((sum, item) => sum + item.subscriptionRevenue, 0),
      commissionRevenue: trendSeries.reduce((sum, item) => sum + item.commissionRevenue, 0),
      overdueAmount: trendSeries[trendSeries.length - 1]?.overdueAmount ?? 0,
      totalDeals: trendSeries.reduce((sum, item) => sum + item.totalDeals, 0),
      successfulPayments: trendSeries.reduce((sum, item) => sum + item.successfulPayments, 0),
      totalCompanies,
      activeCompanies,
    },
    trendSeries,
  };
}

export async function getCompanyAnalyticsReport(context: TenantContext, range: AnalyticsRange = "30d") {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return {
      range,
      generatedAt: new Date(),
      summary: {
        totalDeals: 0,
        totalCollected: 0,
        totalOutstanding: 0,
        overdueAmount: 0,
        overdueCount: 0,
        paymentRequestsSent: 0,
        successfulPayments: 0,
      },
      funnel: {
        inquiryCount: 0,
        reservationCount: 0,
        inquiryToReservationConversion: 0,
        reservationToPaymentConversion: 0,
      },
      collections: {
        overdueRecoveredAmount: 0,
        overdueRecoveredPercent: 0,
        avgDaysToCollect: 0,
      },
      trendSeries: [] as TrendAccumulator[],
    };
  }

  const [
    latestSnapshot,
    trendSeriesRaw,
    summaryAgg,
    inquiryCount,
    reservationCount,
    paymentRequestCount,
    successfulPaymentCount,
    paidTransactionRows,
  ] = await Promise.all([
    loadLatestCompanySnapshot(context.companyId),
    loadCompanySnapshotRows(context.companyId, range),
    prisma.transaction.aggregate({
      where: { companyId: context.companyId },
      _count: { id: true },
      _sum: {
        outstandingBalance: true,
      },
    }),
    prisma.inquiry.count({ where: { companyId: context.companyId } }),
    prisma.reservation.count({ where: { companyId: context.companyId } }),
    prisma.paymentRequest.count({ where: { companyId: context.companyId } }),
    prisma.payment.count({ where: { companyId: context.companyId, status: "SUCCESS" } }),
    prisma.payment.findMany({
      where: {
        companyId: context.companyId,
        status: "SUCCESS",
        transactionId: { not: null },
      },
      distinct: ["transactionId"],
      select: { transactionId: true },
    }),
  ]);

  const trendSeries =
    trendSeriesRaw.some((item) => item.inquiries > 0 || item.reservations > 0 || item.inflow > 0)
      ? trendSeriesRaw
      : await buildCompanyTrendsFromSource(context.companyId, range);

  const [totalCollected, overdueSummary] = await Promise.all([
    prisma.payment.aggregate({
      where: { companyId: context.companyId, status: "SUCCESS" },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { companyId: context.companyId, paymentStatus: "OVERDUE" },
      _sum: { outstandingBalance: true },
      _count: { id: true },
    }),
  ]);

  const metadata = (latestSnapshot?.metadata as Prisma.JsonObject | null) ?? null;
  const snapshotRecoveredAmount = decimalToNumber(latestSnapshot?.overdueRecoveredAmount);
  const snapshotAvgDaysToCollect = decimalToNumber(latestSnapshot?.avgDaysToCollect);
  const currentOverdueAmount = decimalToNumber(overdueSummary._sum.outstandingBalance);

  return {
    range,
    generatedAt: new Date(),
    summary: {
      totalDeals: summaryAgg._count.id,
      totalCollected: decimalToNumber(totalCollected._sum.amount),
      totalOutstanding: decimalToNumber(summaryAgg._sum.outstandingBalance),
      overdueAmount: currentOverdueAmount,
      overdueCount: overdueSummary._count.id,
      paymentRequestsSent: paymentRequestCount,
      successfulPayments: successfulPaymentCount,
    },
    funnel: {
      inquiryCount,
      reservationCount,
      inquiryToReservationConversion:
        Number(metadata?.inquiryToReservationConversion ?? calculateConversionRate(reservationCount, inquiryCount)),
      reservationToPaymentConversion:
        Number(
          metadata?.reservationToPaymentConversion ??
            calculateConversionRate(paidTransactionRows.length, reservationCount),
        ),
    },
    collections: {
      overdueRecoveredAmount: snapshotRecoveredAmount,
      overdueRecoveredPercent: Number(
        metadata?.overdueRecoveredPercent ?? calculateRecoveryRate(snapshotRecoveredAmount, currentOverdueAmount),
      ),
      avgDaysToCollect: Number(metadata?.avgDaysToCollect ?? snapshotAvgDaysToCollect),
    },
    trendSeries,
  };
}

export function parseAnalyticsRange(input?: string | null): AnalyticsRange {
  if (input === "7d" || input === "30d" || input === "90d" || input === "all") {
    return input;
  }

  return "30d";
}

export function formatAnalyticsCurrency(value: number, currency = "NGN") {
  return formatCurrency(value, currency);
}
