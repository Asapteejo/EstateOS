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

test("public R2 bucket domains are optimized", () => {
  assert.equal(shouldUseUnoptimizedImage("https://pub-abc123.r2.dev/media/photo.webp"), false);
});

test("presigned R2 storage URLs stay unoptimized (signatures bust the cache)", () => {
  assert.equal(
    shouldUseUnoptimizedImage(
      "https://account.r2.cloudflarestorage.com/bucket/key?X-Amz-Signature=abc",
    ),
    true,
  );
});

test("the configured tenant media host is optimized when inlined at build", () => {
  const previous = process.env.NEXT_PUBLIC_R2_PUBLIC_HOST;
  process.env.NEXT_PUBLIC_R2_PUBLIC_HOST = "media.estateos.tech";
  try {
    assert.equal(shouldUseUnoptimizedImage("https://media.estateos.tech/media/photo.webp"), false);
    assert.equal(shouldUseUnoptimizedImage("https://other.example.com/photo.webp"), true);
  } finally {
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_R2_PUBLIC_HOST;
    } else {
      process.env.NEXT_PUBLIC_R2_PUBLIC_HOST = previous;
    }
  }
});

test("image presets expose stable responsive sizes", () => {
  assert.equal(getImageSizes("hero").includes("1200px"), true);
  assert.equal(getImageSizes("thumbnail").includes("160px"), true);
});
