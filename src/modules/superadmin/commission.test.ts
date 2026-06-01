import assert from "node:assert/strict";
import test from "node:test";

import { buildDefaultPlatformCommissionControl } from "@/modules/superadmin/commission";

test("missing Paystack or billing configuration uses an empty commission control", () => {
  assert.deepEqual(buildDefaultPlatformCommissionControl(), {
    commissionPercentage: 0,
    fixedFee: 0,
    notes: "",
  });
});
