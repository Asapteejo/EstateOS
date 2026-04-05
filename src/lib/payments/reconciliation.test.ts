import assert from "node:assert/strict";
import test from "node:test";

import { shouldPersistSuccessfulPaymentArtifacts } from "@/lib/payments/reconciliation";

test("only successful payments generate receipts, commission records, and split settlements", () => {
  assert.equal(shouldPersistSuccessfulPaymentArtifacts("SUCCESS"), true);
  assert.equal(shouldPersistSuccessfulPaymentArtifacts("PENDING"), false);
  assert.equal(shouldPersistSuccessfulPaymentArtifacts("FAILED"), false);
  assert.equal(shouldPersistSuccessfulPaymentArtifacts("EXPIRED"), false);
});
