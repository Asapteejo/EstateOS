import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDemoSession,
  buildFallbackDemoCompanyContext,
  getDefaultDemoSessionRole,
  resolveDemoCompanyContextAfterDbError,
} from "@/lib/auth/session";

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

test("demo company fallback preserves cookie tenant context when database is unavailable", () => {
  const fallback = buildFallbackDemoCompanyContext({
    companyId: "company_test",
    companySlug: "test-tenant",
    branchId: "branch_test",
  });

  assert.deepEqual(fallback, {
    companyId: "company_test",
    companySlug: "test-tenant",
    branchId: "branch_test",
  });
});

test("demo company database errors fall back outside production only", () => {
  const fallback = resolveDemoCompanyContextAfterDbError({
    error: Object.assign(new Error("connection refused"), { code: "P1001" }),
    isProduction: false,
    cookieCompanyId: null,
    cookieCompanySlug: "blueprint-urban-residences",
    cookieBranchId: null,
  });

  assert.equal(fallback.companySlug, "blueprint-urban-residences");

  assert.throws(() =>
    resolveDemoCompanyContextAfterDbError({
      error: Object.assign(new Error("connection refused"), { code: "P1001" }),
      isProduction: true,
      cookieCompanyId: null,
      cookieCompanySlug: null,
      cookieBranchId: null,
    }),
  );
});
