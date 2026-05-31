import assert from "node:assert/strict";
import test from "node:test";

import { brandingConfigSchema } from "@/lib/validations/branding";

test("branding validation accepts a controlled valid theme payload", () => {
  const parsed = brandingConfigSchema.safeParse({
    primaryColor: "#0F5C4D",
    secondaryColor: "#0B4638",
    accentColor: "#B57F35",
    backgroundStyle: "SOFT_GRADIENT",
    backgroundColor: "#F8F6F0",
    surfaceColor: "#FFFFFF",
    textMode: "AUTO",
    logoUrl: "https://example.com/logo.png",
    faviconUrl: "https://example.com/favicon.ico",
    heroImageUrl: "https://example.com/hero.jpg",
    buttonStyle: "PILL",
    cardStyle: "SOFT",
    navStyle: "FLOATING",
  });

  assert.equal(parsed.success, true);
});

test("branding validation accepts current studio asset references", () => {
  const parsed = brandingConfigSchema.safeParse({
    primaryColor: "#0F5C4D",
    secondaryColor: "#0B4638",
    accentColor: "#B57F35",
    backgroundStyle: "SOFT_GRADIENT",
    backgroundColor: "#F8F6F0",
    surfaceColor: "#FFFFFF",
    textMode: "AUTO",
    logoUrl: "/api/assets/public/acme/branding/logo.png",
    faviconUrl: null,
    heroImageUrl: "acme/branding/hero.jpg",
    buttonStyle: "PILL",
    cardStyle: "SOFT",
    navStyle: "FLOATING",
  });

  assert.equal(parsed.success, true);
  if (!parsed.success) {
    assert.fail("Expected branding studio payload to parse.");
  }
  assert.equal(parsed.data.faviconUrl, undefined);
});

test("branding validation rejects invalid colors and malformed asset URLs", () => {
  const parsed = brandingConfigSchema.safeParse({
    primaryColor: "#12345",
    secondaryColor: "#0B4638",
    accentColor: "#B57F35",
    backgroundStyle: "SOFT_GRADIENT",
    backgroundColor: "#F8F6F0",
    surfaceColor: "#FFFFFF",
    textMode: "AUTO",
    logoUrl: "javascript:alert(1)",
    faviconUrl: "",
    heroImageUrl: "bad<asset>",
    buttonStyle: "PILL",
    cardStyle: "SOFT",
    navStyle: "FLOATING",
  });

  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.equal(parsed.error.issues.some((issue) => issue.path.join(".") === "logoUrl"), true);
    assert.equal(parsed.error.issues.some((issue) => issue.path.join(".") === "heroImageUrl"), true);
  }
});
