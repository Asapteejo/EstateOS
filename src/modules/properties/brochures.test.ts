import test from "node:test";
import assert from "node:assert/strict";

import { resolveBrochureRedirectUrl } from "@/modules/properties/brochures";

test("brochure fallback redirect resolves relative path against request url", () => {
  const resolved = resolveBrochureRedirectUrl(
    "http://localhost:3000/brochures/eko-atrium",
    "/brochure",
  );

  assert.equal(resolved.toString(), "http://localhost:3000/brochure");
});

test("brochure redirect preserves already-absolute targets", () => {
  const resolved = resolveBrochureRedirectUrl(
    "http://localhost:3000/brochures/eko-atrium",
    "https://cdn.example.com/brochures/eko-atrium.pdf",
  );

  assert.equal(resolved.toString(), "https://cdn.example.com/brochures/eko-atrium.pdf");
});

test("brochure redirect falls back to brochure page when target is missing", () => {
  const resolved = resolveBrochureRedirectUrl(
    "http://localhost:3000/brochures/eko-atrium",
  );

  assert.equal(resolved.toString(), "http://localhost:3000/brochure");
});
