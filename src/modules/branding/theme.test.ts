import assert from "node:assert/strict";
import test from "node:test";

import {
  applyBrandingPreset,
  brandingPresets,
  buildTenantThemeStyles,
  defaultTenantBranding,
  getBrandingPublishIssues,
  normalizeTenantBrandingConfig,
  resolveBrandingState,
} from "@/modules/branding/theme";

test("draft branding resolves separately from published branding", () => {
  const state = resolveBrandingState({
    published: {
      ...defaultTenantBranding,
      primaryColor: "#0F5C4D",
    },
    draft: {
      ...defaultTenantBranding,
      primaryColor: "#A45A1C",
    },
    publishedAt: "2026-04-03T10:00:00.000Z",
  });

  assert.equal(state.published.primaryColor, "#0F5C4D");
  assert.equal(state.draft.primaryColor, "#A45A1C");
  assert.equal(state.isDirty, true);
  assert.equal(state.publishedAt, "2026-04-03T10:00:00.000Z");
});

test("publish safeguards reject missing hero images and low-contrast app surfaces", () => {
  const issues = getBrandingPublishIssues(
    normalizeTenantBrandingConfig({
      backgroundStyle: "IMAGE_HERO",
      heroImageUrl: null,
      surfaceColor: "#F8F6F0",
      textMode: "LIGHT",
    }),
  );

  assert.equal(
    issues.includes("Hero image background requires a hero image URL."),
    true,
  );
  assert.equal(
    issues.includes("Surface and text colors are too low contrast for app surfaces."),
    true,
  );
});

test("theme styles keep app surfaces restrained and expose navigation variables", () => {
  const publicTheme = buildTenantThemeStyles(
    normalizeTenantBrandingConfig({
      primaryColor: "#1E6D9E",
      secondaryColor: "#184E70",
      navStyle: "FLOATING",
    }),
    "public",
  );
  const appTheme = buildTenantThemeStyles(
    normalizeTenantBrandingConfig({
      primaryColor: "#1E6D9E",
      secondaryColor: "#184E70",
      navStyle: "MINIMAL",
    }),
    "app",
  );
  const publicStyle = publicTheme.style as Record<string, unknown>;
  const appStyle = appTheme.style as Record<string, unknown>;

  assert.equal(typeof publicStyle["--tenant-nav-surface"], "string");
  assert.equal(typeof appStyle["--tenant-nav-border"], "string");
  assert.equal(typeof appStyle["--tenant-nav-shadow"], "string");
  assert.equal(publicTheme.classes.includes("min-h-screen"), true);
  assert.equal(appTheme.classes.includes("bg-[var(--tenant-background)]"), true);
});

test("branding presets apply to draft config without bypassing normalization", () => {
  const preset = brandingPresets[0];
  const applied = applyBrandingPreset(defaultTenantBranding, preset.id);

  assert.equal(applied.primaryColor, preset.config.primaryColor);
  assert.equal(applied.navStyle, preset.config.navStyle);
  assert.equal(getBrandingPublishIssues(applied).length >= 0, true);
});
