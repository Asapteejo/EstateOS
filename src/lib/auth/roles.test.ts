import assert from "node:assert/strict";
import test from "node:test";

import { adminRoles, hasRequiredRole } from "@/lib/auth/roles";

test("default tenant admin roles fail closed for buyers", () => {
  assert.equal(hasRequiredRole(["BUYER"], adminRoles), false);
});

test("default tenant admin roles allow deployed operator equivalents", () => {
  for (const role of ["ADMIN", "STAFF", "LEGAL", "FINANCE"] as const) {
    assert.equal(hasRequiredRole([role], adminRoles), true, role);
  }
});

test("superadmin is not implicitly treated as a tenant operator", () => {
  assert.equal(hasRequiredRole(["SUPER_ADMIN"], adminRoles), false);
});
