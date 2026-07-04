import test from "node:test";
import assert from "node:assert/strict";

import { buildTransactionInstallmentSchedule, deriveDealPaymentStatus, humanizePaymentStatus, summarizeTransactionPayment } from "@/modules/payments/progress";

test("deriveDealPaymentStatus marks outstanding deals overdue when a due installment is missed", () => {
  const status = deriveDealPaymentStatus({
    totalValue: 100000,
    outstandingBalance: 50000,
    schedule: [
      {
        title: "Deposit",
        amount: 50000,
        dueDate: new Date("2026-04-01T00:00:00.000Z"),
        paidAmount: 50000,
        status: "paid",
      },
      {
        title: "Balance",
        amount: 50000,
        dueDate: new Date("2026-04-05T00:00:00.000Z"),
        paidAmount: 0,
        status: "overdue",
      },
    ],
  });

  assert.equal(status, "OVERDUE");
});

test("summarizeTransactionPayment exposes the next due installment", () => {
  const schedule = buildTransactionInstallmentSchedule({
    startedAt: new Date("2026-04-01T00:00:00.000Z"),
    now: new Date("2026-04-02T00:00:00.000Z"),
    installments: [
      { id: "one", title: "Deposit", amount: 40000, dueInDays: 0 },
      { id: "two", title: "Balance", amount: 60000, dueInDays: 14 },
    ],
    payments: [{ status: "SUCCESS", amount: 40000, installmentId: "one", paidAt: new Date("2026-04-01T00:00:00.000Z") }],
  });

  const summary = summarizeTransactionPayment({
    totalValue: 100000,
    outstandingBalance: 60000,
    schedule,
    payments: [{ status: "SUCCESS", amount: 40000, paidAt: new Date("2026-04-01T00:00:00.000Z") }],
  });

  assert.equal(summary.status, "PARTIAL");
  assert.equal(summary.nextDue?.title, "Balance");
});

test("humanizePaymentStatus maps each raw status to a buyer-facing label", () => {
  assert.equal(humanizePaymentStatus("PENDING"), "Awaiting first payment");
  assert.equal(humanizePaymentStatus("PARTIAL"), "In progress");
  assert.equal(humanizePaymentStatus("OVERDUE"), "Overdue");
  assert.equal(humanizePaymentStatus("COMPLETED"), "Paid in full");
});

test("humanizePaymentStatus falls back to the raw value for unknown statuses", () => {
  assert.equal(humanizePaymentStatus("SOMETHING_NEW"), "SOMETHING_NEW");
});
