import assert from "node:assert/strict";
import test from "node:test";
import { resolveAuthenticatedSetupRedirect } from "@/lib/auth/access";

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
