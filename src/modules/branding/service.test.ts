import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveTenantBrandAssetUrl,
  resolveTenantBrandingAssetUrls,
} from "@/modules/branding/service";
import { defaultTenantBranding } from "@/modules/branding/theme";

test("tenant brand asset keys convert to public asset URLs once", () => {
  assert.equal(
    resolveTenantBrandAssetUrl("acme/branding/logo.png"),
    "/api/assets/public/acme/branding/logo.png",
  );
});

test("absolute tenant brand asset URLs remain unchanged", () => {
  assert.equal(
    resolveTenantBrandAssetUrl("https://cdn.example.com/logo.png"),
    "https://cdn.example.com/logo.png",
  );
  assert.equal(
    resolveTenantBrandAssetUrl("/api/assets/public/acme/branding/logo.png"),
    "/api/assets/public/acme/branding/logo.png",
  );
});

test("tenant branding asset URL resolution covers logo favicon and hero", () => {
  const branding = resolveTenantBrandingAssetUrls({
    ...defaultTenantBranding,
    logoUrl: "acme/branding/logo.png",
    faviconUrl: "https://cdn.example.com/favicon.ico",
    heroImageUrl: "/api/assets/public/acme/branding/hero.png",
  });

  assert.equal(branding.logoUrl, "/api/assets/public/acme/branding/logo.png");
  assert.equal(branding.faviconUrl, "https://cdn.example.com/favicon.ico");
  assert.equal(branding.heroImageUrl, "/api/assets/public/acme/branding/hero.png");
});
