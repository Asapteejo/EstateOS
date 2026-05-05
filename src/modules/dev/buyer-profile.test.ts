import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDevBuyerProfileData,
  buildDevBuyerUserUpdate,
  selectDevBuyerUser,
  shouldCreateDevBuyerUser,
} from "@/modules/dev/buyer-profile";

test("repeated dev buyer profile calls reuse existing user id", () => {
  const existing = { id: "demo-buyer", email: "buyer@acmerealty.dev" };

  assert.deepEqual(selectDevBuyerUser({ byId: existing, byEmail: existing }), existing);
  assert.equal(shouldCreateDevBuyerUser({ byId: existing, byEmail: existing }), false);
});

test("dev buyer profile reuses existing email even with a different id", () => {
  const byId = { id: "demo-buyer", email: "old-buyer@acmerealty.dev" };
  const byEmail = { id: "real-user-1", email: "buyer@acmerealty.dev" };

  assert.deepEqual(selectDevBuyerUser({ byId, byEmail }), byEmail);
  assert.equal(shouldCreateDevBuyerUser({ byId, byEmail }), false);
});

test("dev buyer profile user update stays scoped to selected company", () => {
  const update = buildDevBuyerUserUpdate({
    companyId: "company_123",
    branchId: "branch_123",
    firstName: "Ada",
    lastName: "Okafor",
    email: "buyer@acmerealty.dev",
  });

  assert.equal(update.companyId, "company_123");
  assert.equal(update.branchId, "branch_123");
  assert.equal(update.email, "buyer@acmerealty.dev");
});

test("dev buyer profile marks profile completed", () => {
  const profile = buildDevBuyerProfileData();
  assert.equal(profile.profileCompleted, true);
  assert.equal(profile.country, "Nigeria");
});
