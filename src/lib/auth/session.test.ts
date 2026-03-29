import test from "node:test";
import assert from "node:assert/strict";

import { buildDemoSession, getDefaultDemoSessionRole } from "@/lib/auth/session";

test("development demo roles stay explicit per surface", () => {
  assert.equal(getDefaultDemoSessionRole("marketing"), null);
  assert.equal(getDefaultDemoSessionRole("portal"), "buyer");
  assert.equal(getDefaultDemoSessionRole("admin"), "admin");
  assert.equal(getDefaultDemoSessionRole("superadmin"), "superadmin");
});

test("demo sessions keep tenant admin and superadmin boundaries separate", () => {
  const buyer = buildDemoSession("buyer");
  const admin = buildDemoSession("admin");
  const superadmin = buildDemoSession("superadmin");

  assert.deepEqual(buyer.roles, ["BUYER"]);
  assert.deepEqual(admin.roles, ["ADMIN"]);
  assert.deepEqual(superadmin.roles, ["SUPER_ADMIN"]);
});
