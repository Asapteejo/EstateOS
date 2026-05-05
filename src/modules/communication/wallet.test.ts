import test from "node:test";
import assert from "node:assert/strict";

import {
  applyUsageCredits,
  buildManualLedgerEntry,
  buildDefaultWalletSnapshot,
  buildUsageLedgerEntry,
  calculateManualBalanceAfter,
  canAdjustCommunicationWallet,
  calculateUsageBalanceAfter,
  getCreditsFromAmount,
  isWalletLowBalance,
  normalizeManualCreditAmount,
  normalizeUsageCreditAmount,
} from "@/modules/communication/wallet";

test("communication wallet usage creates a negative ledger amount", () => {
  assert.equal(normalizeUsageCreditAmount(1), -1);
  assert.equal(calculateUsageBalanceAfter(0, 1), -1);
});

test("communication wallet auto-creation starts tenants at zero credits", () => {
  assert.deepEqual(buildDefaultWalletSnapshot("company_a"), {
    companyId: "company_a",
    balance: 0,
    currency: "NGN",
    lowBalanceThreshold: null,
    isBlocked: false,
  });
});

test("communication ledger entry captures tenant usage and resulting balance", () => {
  const entry = buildUsageLedgerEntry({
    companyId: "company_a",
    credits: 1,
    balanceAfter: -1,
    reference: "usage_log_1",
    metadata: {
      channel: "WHATSAPP",
      trigger: "revenue_recovery.stage_1",
    },
  });

  assert.deepEqual(entry, {
    companyId: "company_a",
    type: "USAGE",
    amount: -1,
    balanceAfter: -1,
    reference: "usage_log_1",
    metadata: {
      channel: "WHATSAPP",
      trigger: "revenue_recovery.stage_1",
    },
  });
});

test("multiple whatsapp sends accumulate usage and allow negative balance", () => {
  assert.equal(applyUsageCredits(0, [1, 1, 1]), -3);
  assert.equal(applyUsageCredits(2, [1, 1, 1]), -1);
});

test("usage accounting is tenant-isolated by company id in ledger entries", () => {
  const companyA = buildUsageLedgerEntry({
    companyId: "company_a",
    credits: 1,
    balanceAfter: -1,
  });
  const companyB = buildUsageLedgerEntry({
    companyId: "company_b",
    credits: 1,
    balanceAfter: -1,
  });

  assert.equal(companyA.companyId, "company_a");
  assert.equal(companyB.companyId, "company_b");
  assert.notEqual(companyA.companyId, companyB.companyId);
});

test("low balance detection is soft threshold only", () => {
  assert.equal(isWalletLowBalance({ balance: 0, lowBalanceThreshold: 5 }), true);
  assert.equal(isWalletLowBalance({ balance: -3, lowBalanceThreshold: 0 }), true);
  assert.equal(isWalletLowBalance({ balance: 10, lowBalanceThreshold: 5 }), false);
  assert.equal(isWalletLowBalance({ balance: -3, lowBalanceThreshold: null }), false);
});

test("usage credits must be positive integers", () => {
  assert.throws(() => normalizeUsageCreditAmount(0), /positive integer/);
  assert.throws(() => normalizeUsageCreditAmount(1.5), /positive integer/);
});

test("superadmin can adjust wallet and tenant roles cannot", () => {
  assert.equal(canAdjustCommunicationWallet(["SUPER_ADMIN"]), true);
  assert.equal(canAdjustCommunicationWallet(["ADMIN"]), false);
  assert.equal(canAdjustCommunicationWallet(["BUYER"]), false);
});

test("manual credit adjustment accepts positive and negative integer amounts", () => {
  assert.equal(normalizeManualCreditAmount(100), 100);
  assert.equal(normalizeManualCreditAmount(-25), -25);
  assert.equal(calculateManualBalanceAfter(10, 100), 110);
  assert.equal(calculateManualBalanceAfter(10, -25), -15);
});

test("manual adjustment ledger entry captures balance changes", () => {
  const entry = buildManualLedgerEntry({
    companyId: "company_a",
    type: "TOP_UP",
    amount: 100,
    balanceAfter: 75,
    reference: "Pilot credit",
  });

  assert.deepEqual(entry, {
    companyId: "company_a",
    type: "TOP_UP",
    amount: 100,
    balanceAfter: 75,
    reference: "Pilot credit",
    metadata: undefined,
  });
});

test("manual credit adjustment rejects zero and non-integer amounts", () => {
  assert.throws(() => normalizeManualCreditAmount(0), /non-zero integer/);
  assert.throws(() => normalizeManualCreditAmount(Number.NaN), /non-zero integer/);
  assert.throws(() => normalizeManualCreditAmount(10.5), /non-zero integer/);
});

test("paystack top-up pricing converts naira to whatsapp credits", () => {
  assert.equal(getCreditsFromAmount(100), 10);
  assert.equal(getCreditsFromAmount(5_000), 500);
  assert.equal(getCreditsFromAmount(10_000), 1000);
  assert.throws(() => getCreditsFromAmount(0), /greater than zero/);
});
