import test from "node:test";
import assert from "node:assert/strict";

import {
  assertInstallmentMatchesCompany,
  assertInstallmentMatchesTransaction,
  buildPaystackWebhookEventId,
  PAYMENT_INSTALLMENT_RULE,
  selectTenantOwnedRelationId,
  resolveReconciliationStatus,
} from "@/lib/payments/semantics";

test("payment/installment rule is explicit and non-ambiguous", () => {
  assert.match(PAYMENT_INSTALLMENT_RULE, /multiple payments/i);
  assert.match(PAYMENT_INSTALLMENT_RULE, /at most one installment/i);
});

test("buildPaystackWebhookEventId uses provider id when present", () => {
  assert.equal(
    buildPaystackWebhookEventId({
      event: "charge.success",
      providerId: 991,
      reference: "acme__pay_1",
    }),
    "charge.success:991",
  );
});

test("buildPaystackWebhookEventId falls back to reference when provider id is missing", () => {
  assert.equal(
    buildPaystackWebhookEventId({
      event: "charge.success",
      reference: "acme__pay_1",
    }),
    "charge.success:acme__pay_1",
  );
});

test("assertInstallmentMatchesCompany rejects cross-tenant linkage", () => {
  assert.throws(
    () => assertInstallmentMatchesCompany("company_a", "company_b"),
    /resolved tenant/,
  );
});

test("assertInstallmentMatchesTransaction rejects mismatched property linkage", () => {
  assert.throws(
    () => assertInstallmentMatchesTransaction("property_a", "property_b"),
    /transaction property/,
  );
});

test("payment webhook relation metadata is accepted only for the resolved tenant", () => {
  assert.equal(
    selectTenantOwnedRelationId("company-a", { id: "transaction-a", companyId: "company-a" }),
    "transaction-a",
  );
  assert.equal(
    selectTenantOwnedRelationId("company-a", { id: "transaction-b", companyId: "company-b" }),
    undefined,
  );
});

test("first successful reconciliation triggers money mutations exactly once", () => {
  // New payment (or PENDING) turning SUCCESS -> mutate balances.
  assert.deepEqual(
    resolveReconciliationStatus({ previousStatus: null, incomingStatus: "SUCCESS" }),
    { status: "SUCCESS", isFirstSuccessfulReconciliation: true },
  );
  assert.deepEqual(
    resolveReconciliationStatus({ previousStatus: "PENDING", incomingStatus: "SUCCESS" }),
    { status: "SUCCESS", isFirstSuccessfulReconciliation: true },
  );
  // Duplicate success event for the same reference -> never mutate again.
  assert.deepEqual(
    resolveReconciliationStatus({ previousStatus: "SUCCESS", incomingStatus: "SUCCESS" }),
    { status: "SUCCESS", isFirstSuccessfulReconciliation: false },
  );
});

test("a late FAILED event can never downgrade a SUCCESS payment", () => {
  assert.deepEqual(
    resolveReconciliationStatus({ previousStatus: "SUCCESS", incomingStatus: "FAILED" }),
    { status: "SUCCESS", isFirstSuccessfulReconciliation: false },
  );
  // Failures on non-success payments still record normally.
  assert.deepEqual(
    resolveReconciliationStatus({ previousStatus: "PENDING", incomingStatus: "FAILED" }),
    { status: "FAILED", isFirstSuccessfulReconciliation: false },
  );
});
