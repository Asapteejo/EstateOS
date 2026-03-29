import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { formatCurrency, formatDate } from "@/lib/utils";

type PlanDistributionInput = Array<{
  companyName: string;
  subscriptionStatus: string | null;
  planName: string | null;
  interval: string | null;
  hasActivePayout: boolean;
}>;

type CompanyHealthRow = {
  companyId: string;
  companyName: string;
  companySlug: string;
  planLabel: string;
  subscriptionStatus: string;
  payoutReadiness: string;
  transactionVolume: string;
  commissionEarned: string;
};

export function buildCompaniesByPlanSummary(input: PlanDistributionInput) {
  const counts = new Map<string, number>();

  for (const company of input) {
    const label = company.planName
      ? `${company.planName} ${company.interval?.toLowerCase() ?? ""}`.trim()
      : "No valid plan";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([label, count]) => ({ label, count }));
}

export function buildCompanyAlertBuckets(input: PlanDistributionInput) {
  return {
    noValidPlan: input.filter((company) => !company.planName || !company.subscriptionStatus).length,
    missingPayoutSetup: input.filter((company) => !company.hasActivePayout).length,
  };
}

export async function getSuperadminDashboardData() {
  if (!featureFlags.hasDatabase) {
    return {
      metrics: [
        { label: "Total companies", value: "1", detail: "Demo tenant" },
        { label: "Active subscriptions", value: "0", detail: "Paid or trial" },
        { label: "Granted plans", value: "1", detail: "Superadmin-managed" },
        { label: "Expired subscriptions", value: "0", detail: "Needs intervention" },
        { label: "Transaction volume", value: "NGN 12,500,000", detail: "Successful payments" },
        { label: "Commission earned", value: "NGN 25,000", detail: "Platform fee" },
        { label: "Payout readiness issues", value: "0", detail: "Split setup required" },
        { label: "Total buyers", value: "1", detail: "Across all companies" },
        { label: "Total staff", value: "1", detail: "Operators with roles" },
      ],
      recentBillingEvents: [
        ["Acme Realty", "PLAN_GRANTED", "Growth annual granted", "Today"],
      ],
      recentPaymentEvents: [
        ["Acme Realty", "PAY-11082", "NGN 12,500,000", "SUCCESS"],
      ],
      recentAuditEvents: [
        ["Acme Realty", "BILLING", "CompanySubscription", "Today"],
      ],
      companiesByPlan: [{ label: "Growth annual", count: 1 }],
      companiesMissingPlan: [],
      companiesMissingPayout: [],
      companies: [
        {
          companyId: "demo-company-acme",
          companyName: "Acme Realty",
          companySlug: "acme-realty",
          planLabel: "Growth annual",
          subscriptionStatus: "GRANTED",
          payoutReadiness: "Ready",
          transactionVolume: "NGN 12,500,000",
          commissionEarned: "NGN 25,000",
        },
      ],
    };
  }

  const [
    companies,
    activeSubscriptions,
    grantedPlans,
    expiredSubscriptions,
    successfulPayments,
    commissionAggregate,
    totalBuyers,
    totalStaff,
    recentBillingEvents,
    recentPayments,
    recentAuditEvents,
  ] = await Promise.all([
    prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        subscriptions: {
          where: {
            isCurrent: true,
            status: {
              in: ["ACTIVE", "TRIAL", "GRANTED"],
            },
          },
          orderBy: { startsAt: "desc" },
          take: 1,
          select: {
            status: true,
            interval: true,
            plan: {
              select: {
                name: true,
              },
            },
          },
        },
        providerAccounts: {
          where: {
            isDefaultPayout: true,
            status: "ACTIVE",
          },
          take: 1,
          select: {
            id: true,
          },
        },
        payments: {
          where: {
            status: "SUCCESS",
          },
          select: {
            amount: true,
          },
        },
        commissionRecords: {
          select: {
            platformCommission: true,
          },
        },
      },
    }),
    prisma.companySubscription.count({
      where: {
        isCurrent: true,
        status: {
          in: ["ACTIVE", "TRIAL"],
        },
      },
    }),
    prisma.companySubscription.count({
      where: {
        isCurrent: true,
        status: "GRANTED",
      },
    }),
    prisma.companySubscription.count({
      where: {
        status: "EXPIRED",
      },
    }),
    prisma.payment.aggregate({
      where: {
        status: "SUCCESS",
      },
      _sum: {
        amount: true,
      },
    }),
    prisma.commissionRecord.aggregate({
      _sum: {
        platformCommission: true,
      },
    }),
    prisma.user.count({
      where: {
        roles: {
          some: {
            role: {
              name: "BUYER",
            },
          },
        },
      },
    }),
    prisma.user.count({
      where: {
        roles: {
          some: {
            role: {
              name: {
                in: ["STAFF", "ADMIN", "LEGAL", "FINANCE"],
              },
            },
          },
        },
      },
    }),
    prisma.billingEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        type: true,
        summary: true,
        createdAt: true,
        company: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.payment.findMany({
      where: {
        status: {
          in: ["SUCCESS", "FAILED", "PENDING", "OVERDUE"],
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        providerReference: true,
        amount: true,
        status: true,
        company: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        action: true,
        entityType: true,
        createdAt: true,
        company: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  const planDistributionInput = companies.map((company) => ({
    companyName: company.name,
    subscriptionStatus: company.subscriptions[0]?.status ?? null,
    planName: company.subscriptions[0]?.plan.name ?? null,
    interval: company.subscriptions[0]?.interval ?? null,
    hasActivePayout: company.providerAccounts.length > 0,
  }));

  const alerts = buildCompanyAlertBuckets(planDistributionInput);
  const companyRows: CompanyHealthRow[] = companies.map((company) => {
    const transactionVolume = company.payments.reduce(
      (sum, payment) => sum + (payment.amount.toNumber?.() ?? Number(payment.amount)),
      0,
    );
    const commissionEarned = company.commissionRecords.reduce(
      (sum, record) =>
        sum + (record.platformCommission.toNumber?.() ?? Number(record.platformCommission)),
      0,
    );

    return {
      companyId: company.id,
      companyName: company.name,
      companySlug: company.slug,
      planLabel: company.subscriptions[0]
        ? `${company.subscriptions[0].plan.name} ${company.subscriptions[0].interval.toLowerCase()}`
        : "No valid plan",
      subscriptionStatus: company.subscriptions[0]?.status ?? "NO_PLAN",
      payoutReadiness: company.providerAccounts.length > 0 ? "Ready" : "Missing payout setup",
      transactionVolume: formatCurrency(transactionVolume),
      commissionEarned: formatCurrency(commissionEarned),
    };
  });

  return {
    metrics: [
      { label: "Total companies", value: String(companies.length), detail: "All tenants" },
      { label: "Active subscriptions", value: String(activeSubscriptions), detail: "Paid or trial" },
      { label: "Granted plans", value: String(grantedPlans), detail: "Manual overrides" },
      { label: "Expired subscriptions", value: String(expiredSubscriptions), detail: "Needs action" },
      {
        label: "Transaction volume",
        value: formatCurrency(successfulPayments._sum.amount?.toNumber?.() ?? 0),
        detail: "Successful payment volume",
      },
      {
        label: "Commission earned",
        value: formatCurrency(commissionAggregate._sum.platformCommission?.toNumber?.() ?? 0),
        detail: "Platform revenue",
      },
      { label: "Payout readiness issues", value: String(alerts.missingPayoutSetup), detail: "Company setup gaps" },
      { label: "Total buyers", value: String(totalBuyers), detail: "Cross-company" },
      { label: "Total staff", value: String(totalStaff), detail: "Operators and marketers" },
    ],
    recentBillingEvents: recentBillingEvents.map((event) => [
      event.company?.name ?? "Platform",
      event.type,
      event.summary,
      formatDate(event.createdAt, "PPP p"),
    ]),
    recentPaymentEvents: recentPayments.map((payment) => [
      payment.company.name,
      payment.providerReference,
      formatCurrency(payment.amount.toNumber?.() ?? Number(payment.amount)),
      payment.status,
    ]),
    recentAuditEvents: recentAuditEvents.map((event) => [
      event.company?.name ?? "Platform",
      event.action,
      event.entityType,
      formatDate(event.createdAt, "PPP p"),
    ]),
    companiesByPlan: buildCompaniesByPlanSummary(planDistributionInput),
    companiesMissingPlan: companyRows.filter((company) => company.subscriptionStatus === "NO_PLAN"),
    companiesMissingPayout: companyRows.filter((company) => company.payoutReadiness !== "Ready"),
    companies: companyRows,
  };
}

export async function getSuperadminCompanyOverview(companyId: string) {
  if (!featureFlags.hasDatabase) {
    return {
      companyId,
      companyName: "Acme Realty",
      companySlug: "acme-realty",
      currentPlan: "Growth annual",
      subscriptionStatus: "GRANTED",
      payoutReadiness: "Ready",
      transactionVolume: "NGN 12,500,000",
      commissionEarned: "NGN 25,000",
      billingEvents: [["PLAN_GRANTED", "Growth annual granted", "Today"]],
      payments: [["PAY-11082", "NGN 12,500,000", "SUCCESS", "Today"]],
    };
  }

  const company = await prisma.company.findUnique({
    where: {
      id: companyId,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      subscriptions: {
        where: {
          isCurrent: true,
        },
        orderBy: { startsAt: "desc" },
        take: 1,
        select: {
          status: true,
          interval: true,
          plan: {
            select: {
              name: true,
            },
          },
        },
      },
      providerAccounts: {
        where: {
          isDefaultPayout: true,
        },
        take: 1,
        select: {
          status: true,
        },
      },
      payments: {
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: {
          providerReference: true,
          amount: true,
          status: true,
          updatedAt: true,
        },
      },
      commissionRecords: {
        select: {
          platformCommission: true,
        },
      },
      billingEvents: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          type: true,
          summary: true,
          createdAt: true,
        },
      },
    },
  });

  if (!company) {
    throw new Error("Company not found.");
  }

  const transactionVolume = company.payments.reduce(
    (sum, payment) => sum + (payment.amount.toNumber?.() ?? Number(payment.amount)),
    0,
  );
  const commissionEarned = company.commissionRecords.reduce(
    (sum, record) =>
      sum + (record.platformCommission.toNumber?.() ?? Number(record.platformCommission)),
    0,
  );

  return {
    companyId: company.id,
    companyName: company.name,
    companySlug: company.slug,
    currentPlan: company.subscriptions[0]
      ? `${company.subscriptions[0].plan.name} ${company.subscriptions[0].interval.toLowerCase()}`
      : "No valid plan",
    subscriptionStatus: company.subscriptions[0]?.status ?? "NO_PLAN",
    payoutReadiness: company.providerAccounts[0]?.status === "ACTIVE" ? "Ready" : "Missing payout setup",
    transactionVolume: formatCurrency(transactionVolume),
    commissionEarned: formatCurrency(commissionEarned),
    billingEvents: company.billingEvents.map((event) => [
      event.type,
      event.summary,
      formatDate(event.createdAt, "PPP p"),
    ]),
    payments: company.payments.map((payment) => [
      payment.providerReference,
      formatCurrency(payment.amount.toNumber?.() ?? Number(payment.amount)),
      payment.status,
      formatDate(payment.updatedAt, "PPP p"),
    ]),
  };
}
