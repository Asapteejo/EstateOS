import type { AppRole, CommunicationCreditLedgerType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { logWarn } from "@/lib/ops/logger";
export { getCreditsFromAmount } from "@/modules/communication/pricing";

const DEFAULT_WALLET_CURRENCY = "NGN";

type WalletLike = {
  balance: number;
  lowBalanceThreshold: number | null;
};

type RecordUsageInput = {
  companyId: string;
  credits: number;
  reference?: string | null;
  metadata?: Prisma.InputJsonValue;
};

type ManualAdjustmentInput = {
  companyId: string;
  amount: number;
  type: Extract<CommunicationCreditLedgerType, "TOP_UP" | "ADJUSTMENT">;
  reference?: string | null;
  metadata?: Prisma.InputJsonValue;
};

type TopUpInput = {
  companyId: string;
  amountPaid: number;
  currency?: string;
  creditsPurchased: number;
  providerReference: string;
  metadata?: Prisma.InputJsonValue;
};

type UsageLedgerEntryInput = RecordUsageInput & {
  balanceAfter: number;
};

export function normalizeUsageCreditAmount(credits: number) {
  if (!Number.isInteger(credits) || credits <= 0) {
    throw new Error("Usage credits must be a positive integer.");
  }

  return -credits;
}

export function normalizeManualCreditAmount(amount: number) {
  if (!Number.isInteger(amount) || amount === 0) {
    throw new Error("Credit adjustment amount must be a non-zero integer.");
  }

  return amount;
}

export function calculateUsageBalanceAfter(balance: number, credits: number) {
  return balance + normalizeUsageCreditAmount(credits);
}

export function calculateManualBalanceAfter(balance: number, amount: number) {
  return balance + normalizeManualCreditAmount(amount);
}

export function buildUsageLedgerEntry(input: UsageLedgerEntryInput) {
  return {
    companyId: input.companyId,
    type: "USAGE" as const,
    amount: normalizeUsageCreditAmount(input.credits),
    balanceAfter: input.balanceAfter,
    reference: input.reference ?? null,
    metadata: input.metadata,
  };
}

export function buildManualLedgerEntry(input: ManualAdjustmentInput & { balanceAfter: number }) {
  return {
    companyId: input.companyId,
    type: input.type,
    amount: normalizeManualCreditAmount(input.amount),
    balanceAfter: input.balanceAfter,
    reference: input.reference ?? null,
    metadata: input.metadata,
  };
}

export function canAdjustCommunicationWallet(roles: AppRole[]) {
  return roles.includes("SUPER_ADMIN");
}

export function applyUsageCredits(balance: number, usageCredits: number[]) {
  return usageCredits.reduce(
    (currentBalance, credits) => calculateUsageBalanceAfter(currentBalance, credits),
    balance,
  );
}

export function buildDefaultWalletSnapshot(companyId: string) {
  return {
    companyId,
    balance: 0,
    currency: DEFAULT_WALLET_CURRENCY,
    lowBalanceThreshold: null,
    isBlocked: false,
  };
}

export function isWalletLowBalance(wallet: WalletLike) {
  return wallet.lowBalanceThreshold != null && wallet.balance <= wallet.lowBalanceThreshold;
}

export async function getOrCreateCompanyWallet(companyId: string) {
  if (!featureFlags.hasDatabase) {
    const wallet = buildDefaultWalletSnapshot(companyId);
    return {
      id: `demo-wallet-${companyId}`,
      ...wallet,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
  }

  return prisma.companyCommunicationWallet.upsert({
    where: { companyId },
    create: {
      companyId,
      balance: 0,
      currency: DEFAULT_WALLET_CURRENCY,
    },
    update: {},
  });
}

export async function getWalletBalance(companyId: string) {
  const wallet = await getOrCreateCompanyWallet(companyId);
  return wallet.balance;
}

export async function getCompanyWalletOverview(companyId: string, options?: { take?: number }) {
  const take = options?.take ?? 25;
  const wallet = await getOrCreateCompanyWallet(companyId);

  if (!featureFlags.hasDatabase) {
    return {
      wallet,
      ledger: [],
      totalUsage: 0,
    };
  }

  const [ledger, usageAggregate] = await Promise.all([
    prisma.communicationCreditLedger.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take,
    }),
    prisma.communicationCreditLedger.aggregate({
      where: {
        companyId,
        type: "USAGE",
      },
      _sum: {
        amount: true,
      },
    }),
  ]);

  return {
    wallet,
    ledger,
    totalUsage: Math.abs(usageAggregate._sum.amount ?? 0),
  };
}

export async function listCompanyWalletSummaries() {
  if (!featureFlags.hasDatabase) {
    return [];
  }

  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      communicationWallet: true,
      communicationCreditLedger: {
        where: { type: "USAGE" },
        select: { amount: true },
      },
    },
  });

  return companies.map((company) => ({
    companyId: company.id,
    companyName: company.name,
    balance: company.communicationWallet?.balance ?? 0,
    currency: company.communicationWallet?.currency ?? DEFAULT_WALLET_CURRENCY,
    lastUpdatedAt: company.communicationWallet?.updatedAt ?? null,
    totalUsage: Math.abs(
      company.communicationCreditLedger.reduce((sum, entry) => sum + entry.amount, 0),
    ),
  }));
}

export async function adjustCompanyWallet(input: ManualAdjustmentInput) {
  if (!featureFlags.hasDatabase) {
    const balanceAfter = calculateManualBalanceAfter(0, input.amount);
    return {
      wallet: {
        ...buildDefaultWalletSnapshot(input.companyId),
        balance: balanceAfter,
      },
      ledger: buildManualLedgerEntry({
        ...input,
        balanceAfter,
      }),
    };
  }

  return prisma.$transaction(async (tx) => {
    await tx.companyCommunicationWallet.upsert({
      where: { companyId: input.companyId },
      create: {
        companyId: input.companyId,
        balance: 0,
        currency: DEFAULT_WALLET_CURRENCY,
      },
      update: {},
      select: { id: true },
    });

    const amount = normalizeManualCreditAmount(input.amount);
    const wallet = await tx.companyCommunicationWallet.update({
      where: { companyId: input.companyId },
      data: {
        balance: {
          increment: amount,
        },
      },
    });

    const ledger = await tx.communicationCreditLedger.create({
      data: buildManualLedgerEntry({
        ...input,
        balanceAfter: wallet.balance,
      }),
    });

    return { wallet, ledger };
  });
}

export async function recordTopUp(input: TopUpInput) {
  if (input.creditsPurchased <= 0 || !Number.isInteger(input.creditsPurchased)) {
    throw new Error("Top-up credits must be a positive integer.");
  }

  if (!featureFlags.hasDatabase) {
    const balanceAfter = input.creditsPurchased;
    return {
      wallet: {
        ...buildDefaultWalletSnapshot(input.companyId),
        balance: balanceAfter,
      },
      ledger: buildManualLedgerEntry({
        companyId: input.companyId,
        type: "TOP_UP",
        amount: input.creditsPurchased,
        reference: input.providerReference,
        metadata: input.metadata,
        balanceAfter,
      }),
      topUp: {
        companyId: input.companyId,
        provider: "PAYSTACK",
        providerReference: input.providerReference,
        amountPaid: input.amountPaid,
        currency: input.currency ?? DEFAULT_WALLET_CURRENCY,
        creditsPurchased: input.creditsPurchased,
        status: "SUCCESS",
      },
      duplicate: false,
    };
  }

  return prisma.$transaction(async (tx) => {
    const existingTopUp = await tx.communicationTopUp.findUnique({
      where: {
        companyId_providerReference: {
          companyId: input.companyId,
          providerReference: input.providerReference,
        },
      },
      select: {
        id: true,
        status: true,
        ledgerEntryId: true,
      },
    });

    if (existingTopUp?.status === "SUCCESS" && existingTopUp.ledgerEntryId) {
      const wallet = await tx.companyCommunicationWallet.upsert({
        where: { companyId: input.companyId },
        create: {
          companyId: input.companyId,
          balance: 0,
          currency: input.currency ?? DEFAULT_WALLET_CURRENCY,
        },
        update: {},
      });
      return { wallet, ledger: null, topUp: existingTopUp, duplicate: true };
    }

    await tx.companyCommunicationWallet.upsert({
      where: { companyId: input.companyId },
      create: {
        companyId: input.companyId,
        balance: 0,
        currency: input.currency ?? DEFAULT_WALLET_CURRENCY,
      },
      update: {},
      select: { id: true },
    });

    const wallet = await tx.companyCommunicationWallet.update({
      where: { companyId: input.companyId },
      data: {
        balance: {
          increment: input.creditsPurchased,
        },
      },
    });

    const ledger = await tx.communicationCreditLedger.create({
      data: buildManualLedgerEntry({
        companyId: input.companyId,
        type: "TOP_UP",
        amount: input.creditsPurchased,
        balanceAfter: wallet.balance,
        reference: input.providerReference,
        metadata: input.metadata,
      }),
    });

    const topUp = existingTopUp
      ? await tx.communicationTopUp.update({
          where: { id: existingTopUp.id },
          data: {
            status: "SUCCESS",
            ledgerEntryId: ledger.id,
            amountPaid: input.amountPaid,
            currency: input.currency ?? DEFAULT_WALLET_CURRENCY,
            creditsPurchased: input.creditsPurchased,
            metadata: input.metadata,
          },
        })
      : await tx.communicationTopUp.create({
          data: {
            companyId: input.companyId,
            provider: "PAYSTACK",
            providerReference: input.providerReference,
            amountPaid: input.amountPaid,
            currency: input.currency ?? DEFAULT_WALLET_CURRENCY,
            creditsPurchased: input.creditsPurchased,
            status: "SUCCESS",
            ledgerEntryId: ledger.id,
            metadata: input.metadata,
          },
        });

    return { wallet, ledger, topUp, duplicate: false };
  });
}

export async function recordUsage(input: RecordUsageInput) {
  if (!featureFlags.hasDatabase) {
    return {
      wallet: {
        companyId: input.companyId,
        balance: calculateUsageBalanceAfter(0, input.credits),
        lowBalanceThreshold: null,
      },
      ledger: {
        ...buildUsageLedgerEntry({
          ...input,
          balanceAfter: calculateUsageBalanceAfter(0, input.credits),
        }),
        reference: input.reference ?? null,
        metadata: input.metadata,
      },
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.companyCommunicationWallet.upsert({
      where: { companyId: input.companyId },
      create: {
        companyId: input.companyId,
        balance: 0,
        currency: DEFAULT_WALLET_CURRENCY,
      },
      update: {},
      select: { id: true },
    });

    const amount = normalizeUsageCreditAmount(input.credits);
    const wallet = await tx.companyCommunicationWallet.update({
      where: { companyId: input.companyId },
      data: {
        balance: {
          increment: amount,
        },
      },
      select: {
        id: true,
        companyId: true,
        balance: true,
        currency: true,
        lowBalanceThreshold: true,
        isBlocked: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const ledger = await tx.communicationCreditLedger.create({
      data: {
        ...buildUsageLedgerEntry({
          ...input,
          balanceAfter: wallet.balance,
        }),
      },
    });

    return { wallet, ledger };
  });

  if (isWalletLowBalance(result.wallet)) {
    logWarn("Company communication wallet balance is low.", {
      companyId: input.companyId,
      balance: result.wallet.balance,
      lowBalanceThreshold: result.wallet.lowBalanceThreshold,
    });
  }

  return result;
}
