import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTransactionMilestoneState,
  calculateOutstandingBalance,
  canTransitionReservationStatus,
  deriveOverallKycStatus,
  derivePropertyStatusFromReservationStatus,
  deriveTransactionStageFromPayment,
} from "@/modules/transactions/workflow";

test("transaction milestone state marks completed, active, and pending stages consistently", () => {
  const milestones = buildTransactionMilestoneState("RESERVATION_FEE_PAID", new Date("2026-03-29T00:00:00.000Z"));

  assert.equal(milestones[0]?.status, "COMPLETED");
  assert.equal(milestones[1]?.status, "COMPLETED");
  assert.equal(milestones[2]?.status, "ACTIVE");
  assert.equal(milestones[3]?.status, "PENDING");
});

test("payment reconciliation promotes the transaction to final payment when balance is cleared", () => {
  assert.equal(
    deriveTransactionStageFromPayment({
      currentStage: "LEGAL_VERIFICATION",
      outstandingBalanceBefore: 5000000,
      paymentAmount: 5000000,
    }),
    "FINAL_PAYMENT_COMPLETED",
  );

  assert.equal(calculateOutstandingBalance(5000000, 7000000), 0);
});

test("reservation status transitions reject invalid reopen flows", () => {
  assert.equal(canTransitionReservationStatus("ACTIVE", "CANCELLED"), true);
  assert.equal(canTransitionReservationStatus("CANCELLED", "ACTIVE"), false);
  assert.equal(derivePropertyStatusFromReservationStatus("ACTIVE"), "RESERVED");
  assert.equal(derivePropertyStatusFromReservationStatus("EXPIRED"), "AVAILABLE");
});

test("overall KYC status escalates to the strictest buyer-facing state", () => {
  assert.equal(deriveOverallKycStatus([]), "NOT_SUBMITTED");
  assert.equal(deriveOverallKycStatus(["SUBMITTED", "UNDER_REVIEW"]), "UNDER_REVIEW");
  assert.equal(deriveOverallKycStatus(["APPROVED", "APPROVED"]), "APPROVED");
  assert.equal(deriveOverallKycStatus(["APPROVED", "CHANGES_REQUESTED"]), "CHANGES_REQUESTED");
});
