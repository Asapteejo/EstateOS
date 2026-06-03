import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessTenantEntry,
  defaultDashboardForRoles,
  resolveAuthenticatedSetupRedirect,
} from "@/lib/auth/access";

test("incomplete authenticated tenant users are sent to onboarding", () => {
  assert.equal(
    resolveAuthenticatedSetupRedirect({
      area: "admin",
      roles: [],
      companyId: null,
      email: "admin@example.com",
    }),
    "/app/onboarding",
  );
  assert.equal(
    resolveAuthenticatedSetupRedirect({
      area: "portal",
      roles: ["BUYER"],
      companyId: null,
      email: "buyer@example.com",
    }),
    "/app/onboarding",
  );
});

test("allowlisted superadmins missing a persisted role receive setup guidance", () => {
  assert.equal(
    resolveAuthenticatedSetupRedirect({
      area: "superadmin",
      roles: [],
      companyId: null,
      email: "owner@example.com",
      superadminEmails: "owner@example.com",
    }),
    "/app/access?status=superadmin-setup",
  );
});

test("non-allowlisted superadmins fail closed", () => {
  assert.equal(
    resolveAuthenticatedSetupRedirect({
      area: "superadmin",
      roles: ["SUPER_ADMIN"],
      companyId: null,
      email: "public@example.com",
      superadminEmails: "owner@example.com",
    }),
    "/app/access?status=forbidden",
  );
});

test("tenant entry denies superadmin-only accounts for tenant admin intent", () => {
  assert.equal(
    canAccessTenantEntry({
      entry: "admin",
      session: {
        email: "owner@example.com",
        companyId: null,
        roles: ["SUPER_ADMIN"],
      },
      target: { companyId: "blueprint" },
    }),
    false,
  );
  assert.equal(defaultDashboardForRoles(["SUPER_ADMIN"]), "/superadmin");
});

test("tenant entry denies wrong-tenant admin sessions", () => {
  assert.equal(
    canAccessTenantEntry({
      entry: "admin",
      session: {
        email: "admin@example.com",
        companyId: "other-company",
        roles: ["ADMIN"],
      },
      target: { companyId: "blueprint" },
    }),
    false,
  );
});

test("tenant entry allows correct tenant admin sessions", () => {
  assert.equal(
    canAccessTenantEntry({
      entry: "admin",
      session: {
        email: "admin@example.com",
        companyId: "blueprint",
        roles: ["ADMIN"],
      },
      target: { companyId: "blueprint" },
    }),
    true,
  );
});

test("tenant entry allows correct tenant buyer sessions", () => {
  assert.equal(
    canAccessTenantEntry({
      entry: "buyer",
      session: {
        email: "buyer@example.com",
        companyId: "blueprint",
        roles: ["BUYER"],
      },
      target: { companyId: "blueprint" },
    }),
    true,
  );
});

test("tenant host hint alone cannot grant tenant access", () => {
  assert.equal(
    canAccessTenantEntry({
      entry: "admin",
      session: {
        email: "buyer@example.com",
        companyId: "blueprint",
        roles: ["BUYER"],
      },
      target: { companyId: "blueprint" },
    }),
    false,
  );
  assert.equal(
    canAccessTenantEntry({
      entry: "buyer",
      session: null,
      target: { companyId: "blueprint" },
    }),
    false,
  );
});
