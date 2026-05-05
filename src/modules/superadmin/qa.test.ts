import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPaymentQaChecks,
  buildPaystackSecretStatus,
  buildR2SecretStatus,
  buildStorageQaChecks,
  manualBillingAllowsWalkthrough,
} from "@/modules/superadmin/qa";

test("missing Paystack env returns missing statuses without secret values", () => {
  const status = buildPaystackSecretStatus({
    PAYSTACK_SECRET_KEY: "sk_test_secret",
    PAYSTACK_PUBLIC_KEY: "",
  });

  assert.equal(status.PAYSTACK_SECRET_KEY, "Configured");
  assert.equal(status.PAYSTACK_PUBLIC_KEY, "Missing");
  assert.equal(status.PAYSTACK_WEBHOOK_SECRET, "Missing");
  assert.deepEqual(Object.values(status).includes("sk_test_secret" as never), false);
});

test("paid billing fails real payment readiness when Paystack is incomplete", () => {
  const checks = buildPaymentQaChecks({
    billingMode: "PAID",
    paystack: {
      PAYSTACK_SECRET_KEY: "Configured",
      PAYSTACK_PUBLIC_KEY: "Configured",
      PAYSTACK_WEBHOOK_SECRET: "Missing",
    },
  });

  const realPayment = checks.find((check) => check.label === "Real payment testing");

  assert.equal(realPayment?.status, "FAIL");
  assert.match(realPayment?.detail ?? "", /PAID billing requires all Paystack keys/);
});

test("manual billing warns but still allows walkthrough without Paystack", () => {
  const checks = buildPaymentQaChecks({
    billingMode: "MANUAL_OVERRIDE",
    paystack: {
      PAYSTACK_SECRET_KEY: "Missing",
      PAYSTACK_PUBLIC_KEY: "Missing",
      PAYSTACK_WEBHOOK_SECRET: "Missing",
    },
  });

  const realPayment = checks.find((check) => check.label === "Real payment testing");
  const manualWarning = checks.find((check) => check.label === "Manual billing warning");

  assert.equal(realPayment?.status, "WARN");
  assert.equal(manualWarning?.status, "WARN");
  assert.equal(
    manualBillingAllowsWalkthrough({
      billingMode: "MANUAL_OVERRIDE",
      subscriptionStatus: "GRANTED",
    }),
    true,
  );
});

test("missing R2 env fails upload readiness without exposing values", () => {
  const status = buildR2SecretStatus({
    R2_ACCOUNT_ID: "account-id",
    R2_ACCESS_KEY_ID: "access-key",
    R2_SECRET_ACCESS_KEY: "",
    R2_BUCKET_NAME: "estateos-dev",
  });
  const checks = buildStorageQaChecks({ r2: status });
  const upload = checks.find((check) => check.label === "Upload testing");

  assert.equal(status.R2_ACCOUNT_ID, "Configured");
  assert.equal(status.R2_SECRET_ACCESS_KEY, "Missing");
  assert.equal(upload?.status, "FAIL");
  assert.equal(JSON.stringify(checks).includes("account-id"), false);
});
