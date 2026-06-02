import test from "node:test";
import assert from "node:assert/strict";

import { getPaystackComplianceBanner } from "@/components/superadmin/paystack-compliance-banner";

test("superadmin shows a fast empty state while Paystack compliance is pending", () => {
  assert.equal(
    getPaystackComplianceBanner(false),
    "Paystack compliance pending. Live payments disabled.",
  );
  assert.equal(getPaystackComplianceBanner(true), null);
});
