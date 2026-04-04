import {
  hexToRgb,
  mixHexColors,
  normalizeTenantBrandingConfig,
  pickTextColor,
  rgbToHex,
  type TenantBrandingConfig,
} from "@/modules/branding/theme";

type RGB = { r: number; g: number; b: number };

function luminance(color: RGB) {
  return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

function quantizeChannel(value: number) {
  return Math.round(value / 24) * 24;
}

function quantizeColor(color: RGB) {
  return {
    r: quantizeChannel(color.r),
    g: quantizeChannel(color.g),
    b: quantizeChannel(color.b),
  };
}

function buildKey(color: RGB) {
  return `${color.r}-${color.g}-${color.b}`;
}

export function extractPaletteFromPixels(pixels: Uint8ClampedArray) {
  const buckets = new Map<string, { color: RGB; weight: number }>();

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3] ?? 0;
    if (alpha < 140) {
      continue;
    }

    const color = quantizeColor({
      r: pixels[index] ?? 0,
      g: pixels[index + 1] ?? 0,
      b: pixels[index + 2] ?? 0,
    });

    const weight = alpha / 255;
    const key = buildKey(color);
    const existing = buckets.get(key);

    if (existing) {
      existing.weight += weight;
    } else {
      buckets.set(key, { color, weight });
    }
  }

  return [...buckets.values()]
    .sort((left, right) => right.weight - left.weight)
    .map((entry) => rgbToHex(entry.color))
    .slice(0, 6);
}

function pickDominantHex(palette: string[], fallback: string) {
  return palette.find(Boolean) ?? fallback;
}

function pickAccentHex(primary: string, palette: string[], fallback: string) {
  const chosen = palette.find((color) => color !== primary);
  return chosen ?? fallback;
}

function ensureReadableSurface(primary: string) {
  const darkText = pickTextColor("#FFFFFF", "AUTO");
  if (darkText === "#07111B") {
    return "#FFFFFF";
  }
  return mixHexColors(primary, "#FFFFFF", 0.88);
}

export function buildThemeFromLogoPalette(
  palette: string[],
  current?: Partial<TenantBrandingConfig> | null,
) {
  const base = normalizeTenantBrandingConfig(current);
  const primary = pickDominantHex(palette, base.primaryColor);
  const accent = pickAccentHex(primary, palette.slice(1), base.accentColor);
  const secondary = mixHexColors(primary, "#07111B", 0.26);
  const backgroundColor =
    luminance(hexToRgb(primary)) < 128 ? mixHexColors(primary, "#FFF8F1", 0.92) : mixHexColors(primary, "#FFFFFF", 0.9);
  const surfaceColor = ensureReadableSurface(primary);

  return normalizeTenantBrandingConfig({
    ...base,
    primaryColor: primary,
    secondaryColor: secondary,
    accentColor: accent,
    backgroundColor,
    surfaceColor,
    backgroundStyle: base.heroImageUrl ? "IMAGE_HERO" : "SOFT_GRADIENT",
    textMode: "AUTO",
    navStyle: "FLOATING",
    cardStyle: "SOFT",
    buttonStyle: "PILL",
  });
}

export async function generateThemeFromLogoUrl(
  url: string,
  current?: Partial<TenantBrandingConfig> | null,
) {
  if (!url) {
    throw new Error("Upload or choose a logo before generating a theme.");
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new Image();
    nextImage.crossOrigin = "anonymous";
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error("Unable to read this logo for color extraction."));
    nextImage.src = url;
  });

  const canvas = document.createElement("canvas");
  const size = 24;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas is unavailable in this browser.");
  }

  context.drawImage(image, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size).data;
  const palette = extractPaletteFromPixels(pixels);

  return buildThemeFromLogoPalette(palette, current);
}
