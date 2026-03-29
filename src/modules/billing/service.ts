import { Prisma, type BillingEventType, type PaymentProviderCode } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import type { TenantContext } from "@/lib/tenancy/context";
import { assertTenantAccess } from "@/lib/tenancy/context";
import { countForTenant } from "@/lib/tenancy/db";
import {
  addIntervalToDate,
  buildSettlementPreview,
  calculateCommissionBreakdown,
  canPlanUseFeature,
  resolveCompanyPlanStatus,
  type BillingFeature,
  type CompanyPlanStatus,
  type CommissionRuleSnapshot,
  type SettlementAccountSnapshot,
  type SubscriptionSnapshot,
} from "@/modules/billing/logic";

type ScopedCountDelegate = { count: (args?: unknown) => Promise<unknown> };

type PlanWithCurrentSubscriptions = {
  id: string;
  code: string;
  slug: string;
  name: string;
  description: string | null;
  interval: "MONTHLY" | "ANNUAL";
  priceAmount: { toNumber?: () => number } | number;
  currency: string;
  isActive: boolean;
  isPublic: boolean;
  canBeGranted: boolean;
  featureFlags: Prisma.JsonValue | null;
  _count?: { subscriptions: number };
};

function decimalToNumber(value: { toNumber?: () => number } | number | null | undefined) {
  if (value == null) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  return value.toNumber?.() ?? Number(value);
}

function parsePlanFeatureFlags(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const entries = Object.entries(value).filter((entry): entry is [string, boolean] => {
    return typeof entry[1] === "boolean";
  });

  return Object.fromEntries(entries);
}

function demoPlanStatus(): CompanyPlanStatus {
  return {
    state: "ACTIVE",
    isActive: true,
    isGranted: true,
    expiresAt: addIntervalToDate(new Date("2026-01-01T00:00:00.000Z"), "ANNUAL"),
    plan: {
      id: "demo-plan-growth-annual",
      code: "growth",
      slug: "growth-annual",
      name: "Growth",
      interval: "ANNUAL",
      featureFlags: {
        TRANSACTIONS: true,
        ADMIN_OPERATIONS: true,
        BILLING_OVERVIEW: true,
      },
    },
    subscription: {
      id: "demo-subscription-growth",
      status: "GRANTED",
      isCurrent: true,
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: addIntervalToDate(new Date("2026-01-01T00:00:00.000Z"), "ANNUAL"),
      plan: {
        id: "demo-plan-growth-annual",
        code: "growth",
        slug: "growth-annual",
        name: "Growth",
        interval: "ANNUAL",
        featureFlags: {
          TRANSACTIONS: true,
          ADMIN_OPERATIONS: true,
          BILLING_OVERVIEW: true,
        },
      },
      grantReason: "Demo environment",
    },
  };
}

export async function getCompanyPlanStatus(input: {
  context?: TenantContext;
  companyId?: string;
}) {
  if (!featureFlags.hasDatabase) {
    return demoPlanStatus();
  }

  const companyId = input.companyId ?? input.context?.companyId ?? null;
  if (!companyId) {
    return {
      state: "NO_PLAN",
      isActive: false,
      subscription: null,
      plan: null,
      expiresAt: null,
      isGranted: false,
    } satisfies CompanyPlanStatus;
  }

  const subscriptions = await prisma.companySubscription.findMany({
    where: {
      companyId,
    },
    orderBy: {
      startsAt: "desc",
    },
    select: {
      id: true,
      status: true,
      isCurrent: true,
      startsAt: true,
      endsAt: true,
      cancelledAt: true,
      grantReason: true,
      plan: {
        select: {
          id: true,
          code: true,
          slug: true,
          name: true,
          interval: true,
          featureFlags: true,
        },
      },
    },
  });

  return resolveCompanyPlanStatus(
    subscriptions.map((subscription) => ({
      ...subscription,
      plan: {
        ...subscription.plan,
        featureFlags: parsePlanFeatureFlags(subscription.plan.featureFlags),
      },
    })) as SubscriptionSnapshot[],
  );
}

export async function requireCompanyPlanAccess(
  context: TenantContext,
  feature: BillingFeature = "TRANSACTIONS",
) {
  if (context.isSuperAdmin) {
    return demoPlanStatus();
  }

  const status = await getCompanyPlanStatus({ context });
  if (!status.isActive) {
    throw new Error("An active company plan is required for this operation.");
  }

  if (!canPlanUseFeature(status, feature)) {
    throw new Error("Your current company plan does not allow this feature.");
  }

  return status;
}

export async function getApplicableCommissionRule(input: {
  companyId: string;
  planId?: string | null;
}) {
  if (!featureFlags.hasDatabase) {
    return {
      id: "demo-commission-rule",
      feeType: "FLAT",
      flatAmount: 25000,
      percentageRate: null,
      currency: "NGN",
    } satisfies CommissionRuleSnapshot;
  }

  const [billingSettings, companyRule, planRule, defaultRule] = await Promise.all([
    prisma.companyBillingSettings.findUnique({
      where: {
        companyId: input.companyId,
      },
      select: {
        defaultCommissionRule: {
          select: {
            id: true,
            feeType: true,
            flatAmount: true,
            percentageRate: true,
            currency: true,
          },
        },
      },
    }),
    prisma.commissionRule.findFirst({
      where: {
        companyId: input.companyId,
        isActive: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        feeType: true,
        flatAmount: true,
        percentageRate: true,
        currency: true,
      },
    }),
    input.planId
      ? prisma.commissionRule.findFirst({
          where: {
            planId: input.planId,
            isActive: true,
          },
          orderBy: {
            updatedAt: "desc",
          },
          select: {
            id: true,
            feeType: true,
            flatAmount: true,
            percentageRate: true,
            currency: true,
          },
        })
      : Promise.resolve(null),
    prisma.commissionRule.findFirst({
      where: {
        companyId: null,
        planId: null,
        isActive: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        feeType: true,
        flatAmount: true,
        percentageRate: true,
        currency: true,
      },
    }),
  ]);

  const rule =
    billingSettings?.defaultCommissionRule ?? companyRule ?? planRule ?? defaultRule;

  if (!rule) {
    throw new Error("No active commission rule is configured.");
  }

  return {
    id: rule.id,
    feeType: rule.feeType,
    flatAmount: decimalToNumber(rule.flatAmount),
    percentageRate: decimalToNumber(rule.percentageRate),
    currency: rule.currency,
  } satisfies CommissionRuleSnapshot;
}

export async function buildSettlementQuote(input: {
  companyId: string;
  amount: number;
  currency: string;
}) {
  if (!featureFlags.hasDatabase) {
    const commissionRule = {
      id: "demo-commission-rule",
      feeType: "FLAT",
      flatAmount: 25000,
      percentageRate: null,
      currency: input.currency,
    } satisfies CommissionRuleSnapshot;

    const breakdown = calculateCommissionBreakdown({
      grossAmount: input.amount,
      rule: commissionRule,
      currency: input.currency,
    });

    return {
      provider: "PAYSTACK" as const,
      commissionRule,
      planStatus: demoPlanStatus(),
      payoutAccount: {
        id: "demo-provider-account",
        provider: "PAYSTACK" as const,
        accountReference: "demo-subaccount",
        subaccountCode: "ACCT_demo",
        settlementCurrency: input.currency,
        supportsTransactionSplit: true,
        status: "ACTIVE" as const,
      },
      breakdown,
      settlement: buildSettlementPreview({
        provider: "PAYSTACK",
        payoutAccount: {
          provider: "PAYSTACK",
          accountReference: "demo-subaccount",
          subaccountCode: "ACCT_demo",
          settlementCurrency: input.currency,
          supportsTransactionSplit: true,
          status: "ACTIVE",
        },
        breakdown,
      }),
    };
  }

  const [billingSettings, providerAccount, planStatus] = await Promise.all([
    prisma.companyBillingSettings.findUnique({
      where: {
        companyId: input.companyId,
      },
      select: {
        transactionProvider: true,
      },
    }),
    prisma.companyPaymentProviderAccount.findFirst({
      where: {
        companyId: input.companyId,
        isDefaultPayout: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        provider: true,
        accountReference: true,
        splitCode: true,
        subaccountCode: true,
        settlementCurrency: true,
        supportsTransactionSplit: true,
        status: true,
      },
    }),
    getCompanyPlanStatus({ companyId: input.companyId }),
  ]);

  const provider = billingSettings?.transactionProvider ?? "PAYSTACK";
  const commissionRule = await getApplicableCommissionRule({
    companyId: input.companyId,
    planId: planStatus.plan?.id,
  });

  const payoutAccount: SettlementAccountSnapshot | null =
    providerAccount && providerAccount.provider === provider
      ? {
          id: providerAccount.id,
          provider: providerAccount.provider,
          accountReference: providerAccount.accountReference,
          splitCode: providerAccount.splitCode,
          subaccountCode: providerAccount.subaccountCode,
          settlementCurrency: providerAccount.settlementCurrency,
          supportsTransactionSplit: providerAccount.supportsTransactionSplit,
          status: providerAccount.status,
        }
      : null;

  const breakdown = calculateCommissionBreakdown({
    grossAmount: input.amount,
    rule: commissionRule,
    currency: input.currency,
  });

  return {
    provider,
    commissionRule,
    planStatus,
    payoutAccount,
    breakdown,
    settlement: buildSettlementPreview({
      provider,
      payoutAccount,
      breakdown,
    }),
  };
}

export async function getBillingDashboardData(context: TenantContext) {
  const companyPlanStatus = await getCompanyPlanStatus({ context });

  if (!featureFlags.hasDatabase || (!context.companyId && !context.isSuperAdmin)) {
    return {
      companyPlanStatus,
      companyBilling: {
        defaultCurrency: "NGN",
        transactionProvider: "PAYSTACK",
        requireActivePlanForTransactions: true,
        payoutReadiness: "Ready",
        commissionRule: "Flat NGN 25,000 per successful payment",
      },
      companySummary: {
        activeSubscriptions: 1,
        grantedPlans: 1,
        expiredSubscriptions: 0,
        commissionEarned: "NGN 25,000",
        subscriptionRevenue: "NGN 0",
        payoutIssues: 0,
      },
      plans: [
        {
          id: "demo-plan-growth-monthly",
          code: "growth",
          slug: "growth-monthly",
          name: "Growth",
          description: "Core CRM and transaction operations for one real estate company.",
          interval: "MONTHLY" as const,
          priceAmount: 150000,
          currency: "NGN",
          isActive: true,
          isPublic: true,
          canBeGranted: true,
          subscriberCount: 0,
        },
        {
          id: "demo-plan-growth-annual",
          code: "growth",
          slug: "growth-annual",
          name: "Growth",
          description: "Annual commitment for the Growth operating tier.",
          interval: "ANNUAL" as const,
          priceAmount: 1500000,
          currency: "NGN",
          isActive: true,
          isPublic: true,
          canBeGranted: true,
          subscriberCount: 1,
        },
      ],
      companies: context.isSuperAdmin
        ? [
            {
              subscriptionId: "demo-subscription-growth",
              companyId: "demo-company-acme",
              companyName: "Acme Realty",
              companySlug: "acme-realty",
              planLabel: "Growth annual",
              status: "GRANTED",
              interval: "ANNUAL",
              expiresAt: "2027-01-01",
              payoutReadiness: "Ready",
              commissionRule: "Flat NGN 25,000",
            },
          ]
        : [],
    };
  }

  if (context.companyId) {
    assertTenantAccess(context, context.companyId);
  }

  const companyId = context.companyId;
  const [
    plansRaw,
    companySettings,
    activePayoutAccount,
    commissionRecordsCount,
    commissionRecordsSum,
    currentCompanySubscriptionCount,
  ] = await Promise.all([
    prisma.plan.findMany({
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
    }),
    companyId
      ? prisma.companyBillingSettings.findUnique({
          where: { companyId },
          include: {
            defaultCommissionRule: true,
          },
        })
      : Promise.resolve(null),
    companyId
      ? prisma.companyPaymentProviderAccount.findFirst({
          where: {
            companyId,
            isDefaultPayout: true,
          },
        })
      : Promise.resolve(null),
    companyId
      ? countForTenant(prisma.commissionRecord as ScopedCountDelegate, context, {
          where: {},
        } as Parameters<typeof prisma.commissionRecord.count>[0])
      : Promise.resolve(0),
    companyId
      ? prisma.commissionRecord.aggregate({
          where: {
            companyId,
          },
          _sum: {
            platformCommission: true,
          },
        })
      : Promise.resolve({ _sum: { platformCommission: null } }),
    companyId
      ? countForTenant(prisma.companySubscription as ScopedCountDelegate, context, {
          where: {
            isCurrent: true,
            status: {
              in: ["ACTIVE", "TRIAL", "GRANTED"],
            },
          },
        } as Parameters<typeof prisma.companySubscription.count>[0])
      : Promise.resolve(0),
  ]);

  const plans = (plansRaw as PlanWithCurrentSubscriptions[]).map((plan) => ({
    id: plan.id,
    code: plan.code,
    slug: plan.slug,
    name: plan.name,
    description: plan.description,
    interval: plan.interval,
    priceAmount: decimalToNumber(plan.priceAmount),
    currency: plan.currency,
    isActive: plan.isActive,
    isPublic: plan.isPublic,
    canBeGranted: plan.canBeGranted,
    subscriberCount: plan._count?.subscriptions ?? 0,
  }));

  let companies: Array<{
    subscriptionId?: string | null;
    companyId: string;
    companyName: string;
    companySlug: string;
    planLabel: string;
    status: string;
    interval: string;
    expiresAt: string;
    payoutReadiness: string;
    commissionRule: string;
  }> = [];

  let platformSummary = {
    activeSubscriptions: Number(currentCompanySubscriptionCount),
    grantedPlans: companyPlanStatus.isGranted ? 1 : 0,
    expiredSubscriptions: companyPlanStatus.state === "EXPIRED" ? 1 : 0,
    commissionEarned: `${companySettings?.defaultCurrency ?? "NGN"} ${decimalToNumber(
      (commissionRecordsSum as { _sum: { platformCommission: { toNumber?: () => number } | null } })._sum.platformCommission,
    ).toLocaleString()}`,
    subscriptionRevenue:
      companyPlanStatus.isActive && !companyPlanStatus.isGranted && companyPlanStatus.plan
        ? `${companyPlanStatus.plan.interval === "MONTHLY" ? "MRR" : "ARR"} ${companyPlanStatus.plan.name}`
        : `${companySettings?.defaultCurrency ?? "NGN"} 0`,
    payoutIssues: activePayoutAccount?.status === "ACTIVE" ? 0 : 1,
  };

  if (context.isSuperAdmin) {
    const [allCompanies, activeSubscriptions, grantedPlans, expiredSubscriptions, commissionEarned] =
      await Promise.all([
        prisma.company.findMany({
          orderBy: { createdAt: "desc" },
          include: {
            billingSettings: {
              include: {
                defaultCommissionRule: true,
              },
            },
            providerAccounts: {
              where: {
                isDefaultPayout: true,
              },
              orderBy: {
                updatedAt: "desc",
              },
              take: 1,
            },
            subscriptions: {
              where: {
                isCurrent: true,
              },
              orderBy: {
                startsAt: "desc",
              },
              take: 1,
              include: {
                plan: true,
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
        prisma.commissionRecord.aggregate({
          _sum: {
            platformCommission: true,
          },
        }),
      ]);

    companies = allCompanies.map((company) => {
      const currentSubscription = company.subscriptions[0] ?? null;
      const rule = company.billingSettings?.defaultCommissionRule;
      const defaultPayout = company.providerAccounts[0] ?? null;

      return {
        subscriptionId: currentSubscription?.id ?? null,
        companyId: company.id,
        companyName: company.name,
        companySlug: company.slug,
        planLabel: currentSubscription
          ? `${currentSubscription.plan.name} ${currentSubscription.interval.toLowerCase()}`
          : "No plan",
        status: currentSubscription?.status ?? "NO_PLAN",
        interval: currentSubscription?.interval ?? "N/A",
        expiresAt: currentSubscription?.endsAt?.toISOString().slice(0, 10) ?? "N/A",
        payoutReadiness: defaultPayout?.status === "ACTIVE" ? "Ready" : "Needs configuration",
        commissionRule:
          rule?.feeType === "PERCENTAGE"
            ? `${decimalToNumber(rule.percentageRate)}%`
            : `Flat ${rule?.currency ?? "NGN"} ${decimalToNumber(rule?.flatAmount).toLocaleString()}`,
      };
    });

    platformSummary = {
      activeSubscriptions,
      grantedPlans,
      expiredSubscriptions,
      commissionEarned: `NGN ${decimalToNumber(
        commissionEarned._sum.platformCommission,
      ).toLocaleString()}`,
      subscriptionRevenue: plans
        .filter((plan) => plan.isActive)
        .reduce((total, plan) => total + plan.priceAmount * plan.subscriberCount, 0)
        .toLocaleString("en-NG", { style: "currency", currency: "NGN" }),
      payoutIssues: companies.filter((company) => company.payoutReadiness !== "Ready").length,
    };
  }

  return {
    companyPlanStatus,
    companyBilling: {
      defaultCurrency: companySettings?.defaultCurrency ?? "NGN",
      transactionProvider: companySettings?.transactionProvider ?? "PAYSTACK",
      requireActivePlanForTransactions:
        companySettings?.requireActivePlanForTransactions ?? true,
      payoutReadiness: activePayoutAccount?.status === "ACTIVE" ? "Ready" : "Needs configuration",
      commissionRule: companySettings?.defaultCommissionRule
        ? companySettings.defaultCommissionRule.feeType === "PERCENTAGE"
          ? `${decimalToNumber(companySettings.defaultCommissionRule.percentageRate)}% per successful transaction`
          : `Flat ${companySettings.defaultCommissionRule.currency} ${decimalToNumber(
              companySettings.defaultCommissionRule.flatAmount,
            ).toLocaleString()} per successful transaction`
        : "No default commission rule configured",
      commissionRecordsCount: Number(commissionRecordsCount),
    },
    companySummary: platformSummary,
    plans,
    companies,
  };
}

export async function recordBillingEvent(input: {
  companyId?: string | null;
  subscriptionId?: string;
  actorUserId?: string;
  type: BillingEventType;
  provider?: PaymentProviderCode;
  amount?: number;
  currency?: string;
  status?: string;
  summary: string;
  metadata?: Prisma.InputJsonValue;
}) {
  if (!featureFlags.hasDatabase) {
    return input;
  }

  return prisma.billingEvent.create({
    data: {
      companyId: input.companyId,
      subscriptionId: input.subscriptionId,
      actorUserId: input.actorUserId,
      type: input.type,
      provider: input.provider,
      amount: input.amount,
      currency: input.currency,
      status: input.status,
      summary: input.summary,
      metadata: input.metadata,
    },
  });
}

export async function auditBillingAction(input: {
  actorUserId?: string;
  companyId?: string | null;
  entityType: string;
  entityId: string;
  summary: string;
  payload?: Prisma.InputJsonValue;
}) {
  return writeAuditLog({
    actorUserId: input.actorUserId,
    companyId: input.companyId,
    action: "BILLING",
    entityType: input.entityType,
    entityId: input.entityId,
    summary: input.summary,
    payload: input.payload,
  });
}
