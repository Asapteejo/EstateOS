import assert from "node:assert/strict";
import test from "node:test";

import { getPaymentSetupState, unwrapApiData } from "@/modules/settings/payment-account-ui";

test("payment account API unwrap reads the shared success envelope", () => {
  assert.deepEqual(
    unwrapApiData({
      success: true,
      data: {
        account: null,
        paystackConfigured: false,
      },
    }),
    {
      account: null,
      paystackConfigured: false,
    },
  );
});

test("payment setup shows empty state when no subaccount exists", () => {
  assert.deepEqual(getPaymentSetupState({ hasAccount: false, paystackConfigured: true }), {
    tone: "warning",
    title: "Set up payment account",
    canSubmit: true,
  });
});

test("payment setup disables writes when Paystack is missing", () => {
  assert.deepEqual(getPaymentSetupState({ hasAccount: false, paystackConfigured: false }), {
    tone: "danger",
    title: "Payment setup requires Paystack configuration",
    canSubmit: false,
  });
});
