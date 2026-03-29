import test from "node:test";
import assert from "node:assert/strict";

import { buildBuyerPaymentProgress } from "@/modules/portal/payments";

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
