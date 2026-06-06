import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildDemoSession,
  buildFallbackDemoCompanyContext,
  getDefaultDemoSessionRole,
  resolveTenantSessionIdentity,
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

test("tenant context uses database user id while preserving Clerk identity", () => {
  assert.deepEqual(
    resolveTenantSessionIdentity({
      userId: "clerk-user-1",
      dbUserId: "db-user-1",
      mode: "clerk",
    }),
    {
      clerkUserId: "clerk-user-1",
      userId: "db-user-1",
    },
  );
});

test("unpersisted Clerk identity cannot be used as a database user id", () => {
  assert.deepEqual(
    resolveTenantSessionIdentity({
      userId: "clerk-user-1",
      dbUserId: null,
      mode: "clerk",
    }),
    {
      clerkUserId: "clerk-user-1",
      userId: null,
    },
  );
});

test("dev access mode session helper is wired before Clerk auth", () => {
  const sessionSource = readFileSync(
    join(process.cwd(), "src", "lib", "auth", "session.ts"),
    "utf8",
  );
  const guardsSource = readFileSync(
    join(process.cwd(), "src", "lib", "auth", "guards.ts"),
    "utf8",
  );
  const layoutSource = readFileSync(
    join(process.cwd(), "src", "app", "layout.tsx"),
    "utf8",
  );

  assert.match(sessionSource, /export async function getDevSession/);
  assert.match(sessionSource, /if \(!featureFlags\.devAccessMode\)/);
  assert.match(sessionSource, /if \(area === "marketing"\)/);
  assert.match(sessionSource, /const devSession = await getDevSession\(area\)/);
  assert.match(sessionSource, /where: \{ clerkUserId: session\.userId \}/);
  assert.match(sessionSource, /dbUserId: user\.id/);
  assert.match(sessionSource, /x-estateos-dev-tenant/);
  assert.doesNotMatch(sessionSource, /userId: "dev-/);
  assert.doesNotMatch(guardsSource, /startsWith\("dev-"\)/);
  assert.match(guardsSource, /startsWith\("demo-"\)/);
  assert.match(layoutSource, /DEV ACCESS MODE ACTIVE/);
  assert.match(layoutSource, /AUTHENTICATION BYPASSED/);
});

test("local seed creates a persisted demo superadmin identity", () => {
  const seedSource = readFileSync(join(process.cwd(), "prisma", "seed.ts"), "utf8");

  assert.match(seedSource, /clerkUserId: "demo-superadmin"/);
  assert.match(seedSource, /email: "owner@estateos\.dev"/);
});
