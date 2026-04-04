import assert from "node:assert/strict";
import test from "node:test";

import { filterMediaLibraryAssets, type MediaLibraryAsset } from "@/modules/uploads/library";

const assets: MediaLibraryAsset[] = [
  {
    id: "1",
    fileName: "Primary Logo",
    purpose: "BRAND_LOGO",
    kind: "image",
    visibility: "PUBLIC",
    url: "/api/assets/public/branding/logo.png",
    storageKey: "branding/logo.png",
    documentId: null,
    createdAt: "2026-04-03T09:00:00.000Z",
    source: "branding",
  },
  {
    id: "2",
    fileName: "Founder Resume",
    purpose: "RESUME",
    kind: "document",
    visibility: "PRIVATE",
    url: null,
    storageKey: "staff-documents/resume.pdf",
    documentId: "doc_1",
    createdAt: "2026-04-03T08:00:00.000Z",
    source: "document",
  },
];

test("media library filtering respects purpose and visibility", () => {
  const filtered = filterMediaLibraryAssets(assets, {
    purpose: "BRAND_LOGO",
    visibility: "PUBLIC",
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.id, "1");
});

test("media library search matches asset metadata without leaking everything", () => {
  const filtered = filterMediaLibraryAssets(assets, {
    query: "resume",
    kind: "document",
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.purpose, "RESUME");
});
