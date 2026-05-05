import assert from "node:assert/strict";
import test from "node:test";

import {
  assertSuperadminOnboardingAccess,
  normalizeCompanySlug,
  subscriptionStatusForBillingMode,
} from "@/modules/superadmin/onboarding";
import {
  superadminCompanyOnboardingSchema,
  superadminSubscriptionOverrideSchema,
} from "@/lib/validations/superadmin";

test("superadmin onboarding requires superadmin access", () => {
  assert.doesNotThrow(() => assertSuperadminOnboardingAccess({ isSuperAdmin: true }));
  assert.throws(
    () => assertSuperadminOnboardingAccess({ isSuperAdmin: false }),
    /Superadmin access is required/,
  );
});

test("company onboarding validation normalizes owner email and date inputs", () => {
  const parsed = superadminCompanyOnboardingSchema.parse({
    companyName: "Mock Estates",
    slug: "mock-estates",
    contactEmail: "ops@mock.test",
    ownerFirstName: "Mock",
    ownerLastName: "Admin",
    ownerEmail: "Owner@Mock.Test",
    plan: "PRO",
    billingMode: "MANUAL_OVERRIDE",
    accessStatus: "ACTIVE",
    subscriptionEndsAt: "2026-12-31",
    internalNote: "Manual dev tenant.",
  });

  assert.equal(parsed.ownerEmail, "owner@mock.test");
  assert.equal(parsed.subscriptionEndsAt, "2026-12-31T00:00:00.000Z");
});

test("manual override subscription changes require an internal note", () => {
  assert.throws(
    () =>
      superadminSubscriptionOverrideSchema.parse({
        companyId: "company_1",
        plan: "PREMIUM",
        billingMode: "MANUAL_OVERRIDE",
        accessStatus: "ACTIVE",
      }),
    /Manual overrides require an internal note/,
  );
});

test("billing modes map to safe subscription statuses", () => {
  assert.equal(subscriptionStatusForBillingMode("MANUAL_OVERRIDE"), "GRANTED");
  assert.equal(subscriptionStatusForBillingMode("TRIAL"), "TRIAL");
  assert.equal(subscriptionStatusForBillingMode("PAID"), "ACTIVE");
});

test("company slugs are sanitized for deterministic mock creation", () => {
  assert.equal(normalizeCompanySlug(" Mock Estates !!! Lagos "), "mock-estates-lagos");
});
