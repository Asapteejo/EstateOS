import assert from "node:assert/strict";
import test from "node:test";

import {
  WALKTHROUGH_VIDEO_MAX_SIZE_BYTES,
  isAllowedWalkthroughVideoMimeType,
  uploadRequestSchema,
} from "@/lib/validations/storage";

test("walkthrough video MIME validation allows mp4 webm and mov", () => {
  assert.equal(isAllowedWalkthroughVideoMimeType("video/mp4"), true);
  assert.equal(isAllowedWalkthroughVideoMimeType("video/webm"), true);
  assert.equal(isAllowedWalkthroughVideoMimeType("video/quicktime"), true);
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

