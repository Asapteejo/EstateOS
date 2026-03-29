import type {
  BillingInterval,
  CommissionType,
  PaymentProviderCode,
  SubscriptionStatus,
} from "@prisma/client";

export type BillingFeature =
  | "TRANSACTIONS"
  | "ADMIN_OPERATIONS"
  | "BILLING_OVERVIEW";

export type BillingPlanSnapshot = {
  id: string;
  code: string;
  slug: string;
  name: string;
  interval: BillingInterval;
  featureFlags?: Record<string, boolean> | null;
};

export type SubscriptionSnapshot = {
  id: string;
  status: SubscriptionStatus;
  isCurrent: boolean;
  startsAt: Date;
  endsAt: Date | null;
  cancelledAt?: Date | null;
  grantReason?: string | null;
  plan: BillingPlanSnapshot;
};

export type CompanyPlanStatus =
  | {
      state: "NO_PLAN";
      isActive: false;
      subscription: null;
      plan: null;
      expiresAt: null;
      isGranted: false;
    }
  | {
      state: "ACTIVE";
      isActive: true;
      subscription: SubscriptionSnapshot;
      plan: BillingPlanSnapshot;
      expiresAt: Date | null;
      isGranted: boolean;
    }
  | {
      state: "EXPIRED";
      isActive: false;
      subscription: SubscriptionSnapshot;
      plan: BillingPlanSnapshot;
      expiresAt: Date | null;
      isGranted: boolean;
    };

export type CommissionRuleSnapshot = {
  id?: string;
  feeType: CommissionType;
  flatAmount?: number | null;
  percentageRate?: number | null;
  currency: string;
};

export type CommissionBreakdown = {
  grossAmount: number;
  providerFee: number;
  platformCommission: number;
  companyAmount: number;
  netAmount: number;
  currency: string;
};

export type SettlementAccountSnapshot = {
  id?: string;
  provider: PaymentProviderCode;
  accountReference: string;
  splitCode?: string | null;
  subaccountCode?: string | null;
  settlementCurrency: string;
  supportsTransactionSplit: boolean;
  status: "PENDING" | "ACTIVE" | "DISABLED";
};

export type SettlementPreview =
  | {
      ready: false;
      provider: PaymentProviderCode;
      reason: string;
      providerPayload: null;
    }
  | {
      ready: true;
      provider: PaymentProviderCode;
      reason: null;
      providerPayload: Record<string, unknown>;
    };

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isSubscriptionCurrentlyActive(
  subscription: SubscriptionSnapshot,
  now: Date,
) {
  if (!subscription.isCurrent) {
    return false;
  }

  if (!["ACTIVE", "TRIAL", "GRANTED"].includes(subscription.status)) {
    return false;
  }

  if (subscription.startsAt > now) {
    return false;
  }

  if (subscription.endsAt && subscription.endsAt < now) {
    return false;
  }

  if (subscription.cancelledAt && subscription.cancelledAt <= now) {
    return false;
  }

  return true;
}

export function addIntervalToDate(
  startDate: Date,
  interval: BillingInterval,
) {
  const next = new Date(startDate);
  if (interval === "MONTHLY") {
    next.setUTCMonth(next.getUTCMonth() + 1);
    return next;
  }

  next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
}

export function resolveCompanyPlanStatus(
  subscriptions: SubscriptionSnapshot[],
  now = new Date(),
): CompanyPlanStatus {
  const current = [...subscriptions].sort(
    (left, right) => right.startsAt.getTime() - left.startsAt.getTime(),
  );

  const active = current.find((subscription) =>
    isSubscriptionCurrentlyActive(subscription, now),
  );

  if (active) {
    return {
      state: "ACTIVE",
      isActive: true,
      subscription: active,
      plan: active.plan,
      expiresAt: active.endsAt,
      isGranted: active.status === "GRANTED",
    };
  }

  const expired = current.find((subscription) =>
    subscription.endsAt ? subscription.endsAt < now : false,
  );

  if (expired) {
    return {
      state: "EXPIRED",
      isActive: false,
      subscription: expired,
      plan: expired.plan,
      expiresAt: expired.endsAt,
      isGranted: expired.status === "GRANTED",
    };
  }

  return {
    state: "NO_PLAN",
    isActive: false,
    subscription: null,
    plan: null,
    expiresAt: null,
    isGranted: false,
  };
}

export function canPlanUseFeature(
  planStatus: CompanyPlanStatus,
  feature: BillingFeature,
) {
  if (!planStatus.isActive || !planStatus.plan) {
    return false;
  }

  const flags = planStatus.plan.featureFlags;
  if (!flags) {
    return true;
  }

  return flags[feature] !== false;
}

export function calculateCommissionBreakdown(input: {
  grossAmount: number;
  providerFee?: number;
  rule: CommissionRuleSnapshot;
  currency: string;
}) {
  const providerFee = roundMoney(Math.max(0, input.providerFee ?? 0));
  const grossAmount = roundMoney(Math.max(0, input.grossAmount));

  let platformCommission = 0;
  if (input.rule.feeType === "FLAT") {
    platformCommission = roundMoney(Math.max(0, input.rule.flatAmount ?? 0));
  } else {
    const percentage = Math.max(0, input.rule.percentageRate ?? 0);
    platformCommission = roundMoney((grossAmount * percentage) / 100);
  }

  if (platformCommission > grossAmount) {
    platformCommission = grossAmount;
  }

  const companyAmount = roundMoney(Math.max(0, grossAmount - platformCommission));
  const netAmount = roundMoney(Math.max(0, companyAmount - providerFee));

  return {
    grossAmount,
    providerFee,
    platformCommission,
    companyAmount,
    netAmount,
    currency: input.currency,
  } satisfies CommissionBreakdown;
}

export function buildSettlementPreview(input: {
  provider: PaymentProviderCode;
  payoutAccount: SettlementAccountSnapshot | null;
  breakdown: CommissionBreakdown;
}) {
  if (!input.payoutAccount) {
    return {
      ready: false,
      provider: input.provider,
      reason: "Company payout configuration is missing.",
      providerPayload: null,
    } satisfies SettlementPreview;
  }

  if (input.payoutAccount.status !== "ACTIVE") {
    return {
      ready: false,
      provider: input.provider,
      reason: "Company payout configuration is not active.",
      providerPayload: null,
    } satisfies SettlementPreview;
  }

  if (!input.payoutAccount.supportsTransactionSplit) {
    return {
      ready: false,
      provider: input.provider,
      reason: "Provider account does not support transaction split settlement.",
      providerPayload: null,
    } satisfies SettlementPreview;
  }

  if (input.payoutAccount.settlementCurrency !== input.breakdown.currency) {
    return {
      ready: false,
      provider: input.provider,
      reason: "Payout account currency does not match the transaction currency.",
      providerPayload: null,
    } satisfies SettlementPreview;
  }

  if (input.provider === "PAYSTACK") {
    if (!input.payoutAccount.subaccountCode) {
      return {
        ready: false,
        provider: input.provider,
        reason: "Paystack split settlement requires an active subaccount code.",
        providerPayload: null,
      } satisfies SettlementPreview;
    }

    return {
      ready: true,
      provider: input.provider,
      reason: null,
      providerPayload: {
        paystack: {
          subaccount: input.payoutAccount.subaccountCode,
          transaction_charge: Math.round(input.breakdown.platformCommission * 100),
          bearer: "subaccount",
        },
      },
    } satisfies SettlementPreview;
  }

  if (input.provider === "STRIPE") {
    return {
      ready: true,
      provider: input.provider,
      reason: null,
      providerPayload: {
        stripe: {
          destinationAccount: input.payoutAccount.accountReference,
          applicationFeeAmount: Math.round(input.breakdown.platformCommission * 100),
        },
      },
    } satisfies SettlementPreview;
  }

  if (input.provider === "FLUTTERWAVE") {
    return {
      ready: true,
      provider: input.provider,
      reason: null,
      providerPayload: {
        flutterwave: {
          subaccounts: [input.payoutAccount.accountReference],
          commissionAmount: input.breakdown.platformCommission,
        },
      },
    } satisfies SettlementPreview;
  }

  return {
    ready: false,
    provider: input.provider,
    reason: "Automatic split settlement is not implemented for this provider yet.",
    providerPayload: null,
  } satisfies SettlementPreview;
}
