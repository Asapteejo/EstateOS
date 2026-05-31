import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveTenantBrandingPresentation,
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

test("tenant branding presentation prefers published branding over company fallback", () => {
  const presentation = resolveTenantBrandingPresentation({
    companyName: "Acme Realty",
    companySlug: "acme-realty",
    fallback: {
      logoUrl: "acme/company-logo.png",
      primaryColor: "#111111",
      accentColor: "#222222",
    },
    branding: {
      logoUrl: "acme/published-logo.png",
      primaryColor: "#1E6D9E",
      accentColor: "#E0A43A",
      backgroundColor: "#F4F8FB",
      surfaceColor: "#FFFFFF",
    },
  });

  assert.equal(presentation.companyName, "Acme Realty");
  assert.equal(presentation.logoUrl, "/api/assets/public/acme/published-logo.png");
  assert.equal(presentation.primaryColor, "#1E6D9E");
  assert.equal(presentation.accentColor, "#E0A43A");
  assert.equal(presentation.cssVariables["--tenant-primary"], "#1E6D9E");
});

test("tenant branding presentation falls back to company settings when no published branding exists", () => {
  const presentation = resolveTenantBrandingPresentation({
    companySlug: "cedar-homes",
    fallback: {
      logoUrl: "cedar/logo.png",
      primaryColor: "#295A73",
      accentColor: "#7AB3C9",
    },
  });

  assert.equal(presentation.companyName, "Cedar Homes");
  assert.equal(presentation.logoUrl, "/api/assets/public/cedar/logo.png");
  assert.equal(presentation.primaryColor, "#295A73");
  assert.equal(presentation.accentColor, "#7AB3C9");
});

test("different tenants resolve isolated branding presentations", () => {
  const left = resolveTenantBrandingPresentation({
    companyName: "Left Homes",
    branding: {
      logoUrl: "left/logo.png",
      primaryColor: "#0F5C4D",
    },
  });
  const right = resolveTenantBrandingPresentation({
    companyName: "Right Homes",
    branding: {
      logoUrl: "right/logo.png",
      primaryColor: "#A45239",
    },
  });

  assert.equal(left.logoUrl, "/api/assets/public/left/logo.png");
  assert.equal(right.logoUrl, "/api/assets/public/right/logo.png");
  assert.notEqual(left.cssVariables["--tenant-primary"], right.cssVariables["--tenant-primary"]);
});
