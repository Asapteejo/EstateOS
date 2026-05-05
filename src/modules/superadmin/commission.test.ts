import assert from "node:assert/strict";
import test from "node:test";

import { canManagePlatformCommission } from "@/modules/superadmin/commission";

test("platform commission management is superadmin-only", () => {
  assert.equal(canManagePlatformCommission({ roles: ["SUPER_ADMIN"] }), true);
  assert.equal(canManagePlatformCommission({ roles: ["ADMIN"] }), false);
  assert.equal(canManagePlatformCommission({ roles: ["BUYER"] }), false);
});
