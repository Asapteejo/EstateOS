export type PaymentProgressInput = {
  totalPayableAmount: number;
  amountPaidSoFar: number;
  installmentSchedule?: Array<{
    title: string;
    amount: number;
    status: "paid" | "due" | "upcoming" | "overdue";
    dueDate?: string;
  }>;
};

export type PaymentMarketerDisplay = {
  fullName: string;
  title: string;
  slug: string;
  avatarUrl: string | null;
};

export function buildBuyerPaymentProgress(input: PaymentProgressInput) {
  const outstandingBalance = Math.max(0, input.totalPayableAmount - input.amountPaidSoFar);
  const progressPercent =
    input.totalPayableAmount <= 0
      ? 0
      : Math.min(100, Math.round((input.amountPaidSoFar / input.totalPayableAmount) * 100));

  const nextDueInstallment =
    input.installmentSchedule?.find((item) => item.status === "overdue") ??
    input.installmentSchedule?.find((item) => item.status === "due") ??
    input.installmentSchedule?.find((item) => item.status === "upcoming") ??
    null;

  return {
    totalPayableAmount: input.totalPayableAmount,
    amountPaidSoFar: input.amountPaidSoFar,
    outstandingBalance,
    progressPercent,
    nextDueInstallment,
    nextDueDate: nextDueInstallment?.dueDate ?? null,
    installmentSchedule: input.installmentSchedule ?? [],
    isFullyPaid: outstandingBalance === 0 && input.totalPayableAmount > 0,
  };
}

export function resolveBuyerPaymentMarketer(input: {
  payments: Array<{ marketer: PaymentMarketerDisplay | null }>;
  transactionMarketer?: PaymentMarketerDisplay | null;
  reservationMarketer?: PaymentMarketerDisplay | null;
}) {
  for (let index = input.payments.length - 1; index >= 0; index -= 1) {
    const marketer = input.payments[index]?.marketer;
    if (marketer) {
      return marketer;
    }
  }

  return input.transactionMarketer ?? input.reservationMarketer ?? null;
}
