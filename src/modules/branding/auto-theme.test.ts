import assert from "node:assert/strict";
import test from "node:test";

import {
  buildThemeFromLogoPalette,
  extractPaletteFromPixels,
} from "@/modules/branding/auto-theme";

test("logo palette extraction groups visible pixels into a stable palette", () => {
  const pixels = new Uint8ClampedArray([
    12, 92, 77, 255,
    12, 92, 77, 255,
    181, 127, 53, 255,
    255, 255, 255, 0,
  ]);

  const palette = extractPaletteFromPixels(pixels);

  assert.equal(palette.length >= 2, true);
  assert.equal(palette[0]?.startsWith("#"), true);
});

test("generated logo theme stays readable and keeps safe defaults", () => {
  const theme = buildThemeFromLogoPalette(["#0F5C4D", "#B57F35"]);

  assert.equal(theme.primaryColor, "#0F5C4D");
  assert.equal(theme.accentColor, "#B57F35");
  assert.equal(theme.surfaceColor.startsWith("#"), true);
  assert.equal(theme.backgroundStyle === "SOFT_GRADIENT" || theme.backgroundStyle === "IMAGE_HERO", true);
});
