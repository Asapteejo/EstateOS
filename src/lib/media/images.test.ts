import assert from "node:assert/strict";
import test from "node:test";

import { getImageSizes, shouldUseUnoptimizedImage } from "@/lib/media/images";

test("relative asset paths stay optimized by default", () => {
  assert.equal(shouldUseUnoptimizedImage("/api/assets/public/branding/logo.png"), false);
});

test("unknown remote hosts fall back to unoptimized rendering", () => {
  assert.equal(shouldUseUnoptimizedImage("https://cdn.example.com/image.png"), true);
  assert.equal(shouldUseUnoptimizedImage("https://images.unsplash.com/photo-1"), false);
});

test("image presets expose stable responsive sizes", () => {
  assert.equal(getImageSizes("hero").includes("1200px"), true);
  assert.equal(getImageSizes("thumbnail").includes("160px"), true);
});
