import assert from "node:assert/strict";
import test from "node:test";

import { canUploadPurpose } from "@/lib/uploads/policy";

test("buyers may upload profile photos and KYC documents", () => {
  assert.equal(canUploadPurpose({ roles: ["BUYER"], purpose: "BUYER_PROFILE_PHOTO" }), true);
  assert.equal(canUploadPurpose({ roles: ["BUYER"], purpose: "KYC_DOCUMENT" }), true);
});

test("buyers cannot upload tenant-admin or legal assets", () => {
  for (const purpose of [
    "BRAND_LOGO",
    "BRAND_HERO",
    "PROPERTY_MEDIA",
    "CONTRACT_DOCUMENT",
    "COMPANY_SIGNATURE",
    "COMPANY_STAMP",
  ] as const) {
    assert.equal(canUploadPurpose({ roles: ["BUYER"], purpose }), false, purpose);
  }
});

test("tenant admins and legal operators can upload contract assets", () => {
  for (const purpose of ["CONTRACT_DOCUMENT", "COMPANY_SIGNATURE", "COMPANY_STAMP"] as const) {
    assert.equal(canUploadPurpose({ roles: ["ADMIN"], purpose }), true, purpose);
    assert.equal(canUploadPurpose({ roles: ["LEGAL"], purpose }), true, purpose);
  }
});

test("client-selected surface cannot grant an upload permission", () => {
  assert.equal(canUploadPurpose({ roles: ["BUYER"], purpose: "BRAND_LOGO" }), false);
});
