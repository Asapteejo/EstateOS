import test from "node:test";
import assert from "node:assert/strict";

import { buildBuyerPaymentProgress, resolveBuyerPaymentMarketer } from "@/modules/portal/payments";

test("buyer payment progress computes paid, outstanding, and next due installment", () => {
  const progress = buildBuyerPaymentProgress({
    totalPayableAmount: 1000000,
    amountPaidSoFar: 400000,
    installmentSchedule: [
      { title: "Deposit", amount: 400000, status: "paid" },
      { title: "Second tranche", amount: 300000, status: "due" },
      { title: "Final tranche", amount: 300000, status: "upcoming" },
    ],
  });

  assert.equal(progress.outstandingBalance, 600000);
  assert.equal(progress.progressPercent, 40);
  assert.equal(progress.nextDueInstallment?.title, "Second tranche");
  assert.equal(progress.isFullyPaid, false);
});

test("buyer payment marketer resolution prefers payment attribution over transaction and reservation fallback", () => {
  const resolved = resolveBuyerPaymentMarketer({
    payments: [
      { marketer: null },
      {
        marketer: {
          fullName: "Payment Marketer",
          title: "Senior marketer",
          slug: "payment-marketer",
          avatarUrl: null,
        },
      },
    ],
    transactionMarketer: {
      fullName: "Transaction Marketer",
      title: "Closer",
      slug: "transaction-marketer",
      avatarUrl: null,
    },
    reservationMarketer: {
      fullName: "Reservation Marketer",
      title: "Advisor",
      slug: "reservation-marketer",
      avatarUrl: null,
    },
  });

  assert.equal(resolved?.fullName, "Payment Marketer");
});

test("buyer payment marketer resolution falls back when direct payment attribution is absent", () => {
  const resolved = resolveBuyerPaymentMarketer({
    payments: [],
    transactionMarketer: {
      fullName: "Transaction Marketer",
      title: "Closer",
      slug: "transaction-marketer",
      avatarUrl: null,
    },
    reservationMarketer: {
      fullName: "Reservation Marketer",
      title: "Advisor",
      slug: "reservation-marketer",
      avatarUrl: null,
    },
  });

  assert.equal(resolved?.fullName, "Transaction Marketer");
});
