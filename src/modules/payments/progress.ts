import { addDays, isBefore, startOfDay } from "date-fns";

type Decimalish = { toNumber?: () => number } | number;

export type DealPaymentStatusValue = "PENDING" | "PARTIAL" | "COMPLETED" | "OVERDUE";

export type PaymentScheduleEntry = {
  id?: string;
  title: string;
  amount: number;
  dueDate: Date;
  paidAmount: number;
  status: "paid" | "due" | "upcoming" | "overdue";
};

function decimalToNumber(value: Decimalish | null | undefined) {
  if (value == null) {
    return 0;
  }

  return typeof value === "number" ? value : value.toNumber?.() ?? Number(value);
}

export function buildTransactionInstallmentSchedule(input: {
  startedAt: Date;
  installments: Array<{
    id?: string;
    title: string;
    amount: Decimalish;
    dueInDays: number;
  }>;
  payments: Array<{
    status: string;
    amount: Decimalish;
    installmentId?: string | null;
    paidAt?: Date | null;
  }>;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const successfulPayments = input.payments.filter((payment) => payment.status === "SUCCESS");
  const paidByInstallment = new Map<string, number>();

  for (const payment of successfulPayments) {
    if (!payment.installmentId) {
      continue;
    }

    paidByInstallment.set(
      payment.installmentId,
      (paidByInstallment.get(payment.installmentId) ?? 0) + decimalToNumber(payment.amount),
    );
  }

  return input.installments.map((installment) => {
    const amount = decimalToNumber(installment.amount);
    const dueDate = addDays(input.startedAt, installment.dueInDays);
    const paidAmount = installment.id ? paidByInstallment.get(installment.id) ?? 0 : 0;

    let status: PaymentScheduleEntry["status"] = "upcoming";
    if (paidAmount >= amount && amount > 0) {
      status = "paid";
    } else if (isBefore(startOfDay(dueDate), startOfDay(now))) {
      status = "overdue";
    } else if (dueDate <= now) {
      status = "due";
    } else {
      status = "upcoming";
    }

    return {
      id: installment.id,
      title: installment.title,
      amount,
      dueDate,
      paidAmount,
      status,
    };
  });
}

export function deriveDealPaymentStatus(input: {
  totalValue: Decimalish;
  outstandingBalance: Decimalish;
  schedule?: PaymentScheduleEntry[];
}) {
  const totalValue = decimalToNumber(input.totalValue);
  const outstandingBalance = decimalToNumber(input.outstandingBalance);

  if (totalValue > 0 && outstandingBalance <= 0) {
    return "COMPLETED" as const;
  }

  if (input.schedule?.some((entry) => entry.status === "overdue")) {
    return "OVERDUE" as const;
  }

  if (outstandingBalance < totalValue) {
    return "PARTIAL" as const;
  }

  return "PENDING" as const;
}

export function summarizeTransactionPayment(input: {
  totalValue: Decimalish;
  outstandingBalance: Decimalish;
  schedule?: PaymentScheduleEntry[];
  payments?: Array<{ status: string; amount: Decimalish; paidAt?: Date | null }>;
}) {
  const totalValue = decimalToNumber(input.totalValue);
  const outstandingBalance = decimalToNumber(input.outstandingBalance);
  const amountPaid = Math.max(0, totalValue - outstandingBalance);
  const schedule = input.schedule ?? [];
  const nextDue = schedule.find((entry) => entry.status === "due" || entry.status === "overdue" || entry.status === "upcoming") ?? null;
  const successfulPayments = (input.payments ?? []).filter((payment) => payment.status === "SUCCESS");
  const lastPaymentAt = successfulPayments
    .map((payment) => payment.paidAt ?? null)
    .filter((value): value is Date => value instanceof Date)
    .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;

  return {
    totalValue,
    outstandingBalance,
    amountPaid,
    status: deriveDealPaymentStatus({
      totalValue,
      outstandingBalance,
      schedule,
    }),
    nextDue,
    lastPaymentAt,
  };
}
