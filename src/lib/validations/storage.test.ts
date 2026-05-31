import assert from "node:assert/strict";
import test from "node:test";

import {
  KYC_DOCUMENT_MAX_SIZE_BYTES,
  CONTRACT_ASSET_MAX_SIZE_BYTES,
  WALKTHROUGH_VIDEO_MAX_SIZE_BYTES,
  isAllowedContractAssetMimeType,
  isAllowedKycDocumentMimeType,
  isAllowedWalkthroughVideoMimeType,
  uploadRequestSchema,
} from "@/lib/validations/storage";

test("walkthrough video MIME validation allows mp4 webm and mov", () => {
  assert.equal(isAllowedWalkthroughVideoMimeType("video/mp4"), true);
  assert.equal(isAllowedWalkthroughVideoMimeType("video/webm"), true);
  assert.equal(isAllowedWalkthroughVideoMimeType("video/quicktime"), true);
});

test("contract stamp and signature uploads allow only safe private images", () => {
  assert.equal(isAllowedContractAssetMimeType("image/png"), true);
  assert.equal(isAllowedContractAssetMimeType("image/jpeg"), true);
  assert.equal(isAllowedContractAssetMimeType("image/webp"), true);
  assert.equal(isAllowedContractAssetMimeType("application/pdf"), false);

  const valid = uploadRequestSchema.safeParse({
    surface: "admin",
    purpose: "COMPANY_STAMP",
    fileName: "stamp.png",
    contentType: "image/png",
    sizeBytes: 1024,
  });
  assert.equal(valid.success, true);

  const invalid = uploadRequestSchema.safeParse({
    surface: "admin",
    purpose: "COMPANY_SIGNATURE",
    fileName: "signature.pdf",
    contentType: "application/pdf",
    sizeBytes: 1024,
  });
  assert.equal(invalid.success, false);
});

test("contract stamp and signature uploads enforce max size", () => {
  const parsed = uploadRequestSchema.safeParse({
    surface: "admin",
    purpose: "COMPANY_SIGNATURE",
    fileName: "signature.png",
    contentType: "image/png",
    sizeBytes: CONTRACT_ASSET_MAX_SIZE_BYTES + 1,
  });

  assert.equal(parsed.success, false);
  if (parsed.success) {
    assert.fail("Expected oversized contract image to fail.");
  }
  assert.equal(parsed.error.issues.some((issue) => issue.path.join(".") === "sizeBytes"), true);
});

test("walkthrough video MIME validation rejects non-video files", () => {
  const parsed = uploadRequestSchema.safeParse({
    surface: "admin",
    purpose: "PROPERTY_WALKTHROUGH_VIDEO",
    fileName: "walkthrough.png",
    contentType: "image/png",
    sizeBytes: 1024,
  });

  assert.equal(parsed.success, false);
  if (parsed.success) {
    assert.fail("Expected invalid walkthrough MIME type to fail.");
  }
  assert.equal(parsed.error.issues.some((issue) => issue.path.join(".") === "contentType"), true);
});

test("walkthrough video upload request enforces max size", () => {
  const parsed = uploadRequestSchema.safeParse({
    surface: "admin",
    purpose: "PROPERTY_WALKTHROUGH_VIDEO",
    fileName: "walkthrough.mp4",
    contentType: "video/mp4",
    sizeBytes: WALKTHROUGH_VIDEO_MAX_SIZE_BYTES + 1,
  });

  assert.equal(parsed.success, false);
  if (parsed.success) {
    assert.fail("Expected oversized walkthrough video to fail.");
  }
  assert.equal(parsed.error.issues.some((issue) => issue.path.join(".") === "sizeBytes"), true);
});

test("KYC document upload request allows only PDF and safe image types", () => {
  assert.equal(isAllowedKycDocumentMimeType("application/pdf"), true);
  assert.equal(isAllowedKycDocumentMimeType("image/jpeg"), true);
  assert.equal(isAllowedKycDocumentMimeType("image/jpg"), true);
  assert.equal(isAllowedKycDocumentMimeType("image/png"), true);
  assert.equal(isAllowedKycDocumentMimeType("image/webp"), true);
  assert.equal(isAllowedKycDocumentMimeType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), false);
  assert.equal(isAllowedKycDocumentMimeType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"), false);
  assert.equal(isAllowedKycDocumentMimeType("application/zip"), false);
  assert.equal(isAllowedKycDocumentMimeType("application/x-msdownload"), false);

  const invalid = uploadRequestSchema.safeParse({
    surface: "portal",
    purpose: "KYC_DOCUMENT",
    fileName: "id.xlsx",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    sizeBytes: 1024,
  });

  assert.equal(invalid.success, false);
});

test("KYC document upload request enforces max size", () => {
  const parsed = uploadRequestSchema.safeParse({
    surface: "portal",
    purpose: "KYC_DOCUMENT",
    fileName: "id.pdf",
    contentType: "application/pdf",
    sizeBytes: KYC_DOCUMENT_MAX_SIZE_BYTES + 1,
  });

  assert.equal(parsed.success, false);
  if (parsed.success) {
    assert.fail("Expected oversized KYC document to fail.");
  }
  assert.equal(parsed.error.issues.some((issue) => issue.path.join(".") === "sizeBytes"), true);
});
