import assert from "node:assert/strict";
import test from "node:test";

import { getUploadPurposeConfig, isPublicStorageDomain } from "@/modules/uploads/config";

test("branding presets and public marketing assets resolve to public storage domains", () => {
  const logo = getUploadPurposeConfig("BRAND_LOGO");
  const hero = getUploadPurposeConfig("BRAND_HERO");
  const propertyMedia = getUploadPurposeConfig("PROPERTY_MEDIA");
  const walkthroughVideo = getUploadPurposeConfig("PROPERTY_WALKTHROUGH_VIDEO");

  assert.equal(logo.isPublicAsset, true);
  assert.equal(hero.isPublicAsset, true);
  assert.equal(propertyMedia.visibility, "PUBLIC");
  assert.equal(walkthroughVideo.visibility, "PUBLIC");
  assert.equal(walkthroughVideo.accept.includes("video/mp4"), true);
  assert.equal(isPublicStorageDomain(logo.domain), true);
  assert.equal(isPublicStorageDomain(propertyMedia.domain), true);
  assert.equal(isPublicStorageDomain(walkthroughVideo.domain), true);
});

test("private upload purposes stay private and document-backed where required", () => {
  const resume = getUploadPurposeConfig("RESUME");
  const kyc = getUploadPurposeConfig("KYC_DOCUMENT");
  const brochure = getUploadPurposeConfig("BROCHURE");

  assert.equal(resume.isPublicAsset, false);
  assert.equal(resume.documentType, "OTHER");
  assert.equal(kyc.visibility, "PRIVATE");
  assert.equal(brochure.documentType, "BROCHURE");
  assert.equal(isPublicStorageDomain(resume.domain), false);
});
