import assert from "node:assert/strict";
import test from "node:test";

import { isPaystackDemoResponseAllowed } from "@/lib/payments/paystack";

test("Paystack demo responses are disabled by default in production", () => {
  assert.equal(isPaystackDemoResponseAllowed({ nodeEnv: "production" }), false);
});

test("Paystack demo responses require explicit production opt-in", () => {
  assert.equal(
    isPaystackDemoResponseAllowed({ nodeEnv: "production", paymentsDemoMode: true }),
    true,
  );
  assert.equal(isPaystackDemoResponseAllowed({ nodeEnv: "development" }), true);
});
