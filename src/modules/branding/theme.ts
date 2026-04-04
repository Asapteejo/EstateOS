import type { CSSProperties } from "react";

export const backgroundStyles = [
  "CLEAN_APP_DEFAULT",
  "LIGHT",
  "DARK",
  "SOFT_GRADIENT",
  "BRANDED_GRADIENT",
  "IMAGE_HERO",
] as const;

export const textModes = ["AUTO", "LIGHT", "DARK"] as const;
export const buttonStyles = ["PILL", "ROUNDED", "SOFT"] as const;
export const cardStyles = ["SOFT", "GLASS", "OUTLINED"] as const;
export const navStyles = ["SOLID", "FLOATING", "MINIMAL"] as const;

export type BackgroundStyle = (typeof backgroundStyles)[number];
export type TextMode = (typeof textModes)[number];
export type ButtonStyle = (typeof buttonStyles)[number];
export type CardStyle = (typeof cardStyles)[number];
export type NavStyle = (typeof navStyles)[number];

export type TenantBrandingConfig = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundStyle: BackgroundStyle;
  backgroundColor: string;
  surfaceColor: string;
  textMode: TextMode;
  logoUrl: string | null;
  faviconUrl: string | null;
  heroImageUrl: string | null;
  buttonStyle: ButtonStyle;
  cardStyle: CardStyle;
  navStyle: NavStyle;
};

export type TenantBrandingState = {
  draft: TenantBrandingConfig;
  published: TenantBrandingConfig;
  publishedAt: string | null;
  isDirty: boolean;
};

export const brandingPresets = [
  {
    id: "modern-blue",
    name: "Modern Blue",
    description: "Clean, credible, and sales-friendly for modern residential brands.",
    config: {
      primaryColor: "#1E6D9E",
      secondaryColor: "#184E70",
      accentColor: "#E0A43A",
      backgroundStyle: "SOFT_GRADIENT",
      backgroundColor: "#F4F8FB",
      surfaceColor: "#FFFFFF",
      textMode: "AUTO",
      buttonStyle: "PILL",
      cardStyle: "SOFT",
      navStyle: "FLOATING",
    } satisfies Partial<TenantBrandingConfig>,
  },
  {
    id: "luxury-gold",
    name: "Luxury Gold",
    description: "Warm premium contrast for high-value listings and private client positioning.",
    config: {
      primaryColor: "#4B3124",
      secondaryColor: "#2A1B15",
      accentColor: "#C8A15B",
      backgroundStyle: "BRANDED_GRADIENT",
      backgroundColor: "#F5EFE7",
      surfaceColor: "#FFFDF8",
      textMode: "AUTO",
      buttonStyle: "ROUNDED",
      cardStyle: "GLASS",
      navStyle: "FLOATING",
    } satisfies Partial<TenantBrandingConfig>,
  },
  {
    id: "corporate-clean",
    name: "Corporate Clean",
    description: "Calm blue-grey professionalism for commercial and institutional teams.",
    config: {
      primaryColor: "#295A73",
      secondaryColor: "#173847",
      accentColor: "#7AB3C9",
      backgroundStyle: "LIGHT",
      backgroundColor: "#F5F8FA",
      surfaceColor: "#FFFFFF",
      textMode: "AUTO",
      buttonStyle: "SOFT",
      cardStyle: "OUTLINED",
      navStyle: "SOLID",
    } satisfies Partial<TenantBrandingConfig>,
  },
  {
    id: "elegant-dark",
    name: "Elegant Dark",
    description: "Dark luxury presentation with carefully controlled app readability.",
    config: {
      primaryColor: "#182432",
      secondaryColor: "#0B1320",
      accentColor: "#D9B166",
      backgroundStyle: "DARK",
      backgroundColor: "#0E1824",
      surfaceColor: "#FFFFFF",
      textMode: "LIGHT",
      buttonStyle: "PILL",
      cardStyle: "GLASS",
      navStyle: "MINIMAL",
    } satisfies Partial<TenantBrandingConfig>,
  },
  {
    id: "warm-terracotta",
    name: "Warm Terracotta",
    description: "Approachable warmth for family housing, land sales, and human-led brands.",
    config: {
      primaryColor: "#A45239",
      secondaryColor: "#6F2F21",
      accentColor: "#D89F57",
      backgroundStyle: "SOFT_GRADIENT",
      backgroundColor: "#FBF3EE",
      surfaceColor: "#FFFFFF",
      textMode: "AUTO",
      buttonStyle: "ROUNDED",
      cardStyle: "SOFT",
      navStyle: "FLOATING",
    } satisfies Partial<TenantBrandingConfig>,
  },
  {
    id: "emerald-professional",
    name: "Emerald Professional",
    description: "A confident green-led preset for firms that want polished trust cues.",
    config: {
      primaryColor: "#0F5C4D",
      secondaryColor: "#0B4638",
      accentColor: "#B57F35",
      backgroundStyle: "CLEAN_APP_DEFAULT",
      backgroundColor: "#F8F6F0",
      surfaceColor: "#FFFFFF",
      textMode: "AUTO",
      buttonStyle: "PILL",
      cardStyle: "SOFT",
      navStyle: "FLOATING",
    } satisfies Partial<TenantBrandingConfig>,
  },
] as const;

export const defaultTenantBranding: TenantBrandingConfig = {
  primaryColor: "#0f5c4d",
  secondaryColor: "#0b4638",
  accentColor: "#b57f35",
  backgroundStyle: "CLEAN_APP_DEFAULT",
  backgroundColor: "#f8f6f0",
  surfaceColor: "#ffffff",
  textMode: "AUTO",
  logoUrl: null,
  faviconUrl: null,
  heroImageUrl: null,
  buttonStyle: "PILL",
  cardStyle: "SOFT",
  navStyle: "FLOATING",
};

type RGB = { r: number; g: number; b: number };

function clamp(value: number, min = 0, max = 255) {
  return Math.min(max, Math.max(min, value));
}

export function isHexColor(value: string | null | undefined) {
  return Boolean(value && /^#([0-9a-fA-F]{6})$/.test(value));
}

export function normalizeHexColor(value: string | null | undefined, fallback: string) {
  if (!isHexColor(value)) {
    return fallback;
  }

  return value!.toUpperCase();
}

export function hexToRgb(value: string): RGB {
  const normalized = normalizeHexColor(value, "#000000").slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

export function rgbToHex(rgb: RGB) {
  return `#${[rgb.r, rgb.g, rgb.b].map((item) => clamp(item).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export function mixHexColors(left: string, right: string, ratio: number) {
  const a = hexToRgb(left);
  const b = hexToRgb(right);
  const clampedRatio = Math.min(1, Math.max(0, ratio));
  return rgbToHex({
    r: Math.round(a.r + (b.r - a.r) * clampedRatio),
    g: Math.round(a.g + (b.g - a.g) * clampedRatio),
    b: Math.round(a.b + (b.b - a.b) * clampedRatio),
  });
}

export function hexWithAlpha(value: string, alpha: number) {
  const { r, g, b } = hexToRgb(value);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
}

function relativeLuminanceChannel(channel: number) {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function getRelativeLuminance(value: string) {
  const { r, g, b } = hexToRgb(value);
  return (
    0.2126 * relativeLuminanceChannel(r) +
    0.7152 * relativeLuminanceChannel(g) +
    0.0722 * relativeLuminanceChannel(b)
  );
}

export function getContrastRatio(foreground: string, background: string) {
  const bright = getRelativeLuminance(foreground);
  const dark = getRelativeLuminance(background);
  const lightest = Math.max(bright, dark);
  const darkest = Math.min(bright, dark);
  return (lightest + 0.05) / (darkest + 0.05);
}

export function pickTextColor(background: string, mode: TextMode) {
  if (mode === "LIGHT") {
    return "#FFFFFF";
  }

  if (mode === "DARK") {
    return "#07111B";
  }

  return getContrastRatio("#07111B", background) >= 7 ? "#07111B" : "#FFFFFF";
}

export function normalizeTenantBrandingConfig(
  input?: Partial<TenantBrandingConfig> | null,
): TenantBrandingConfig {
  const merged = {
    ...defaultTenantBranding,
    ...(input ?? {}),
  };

  return {
    primaryColor: normalizeHexColor(merged.primaryColor, defaultTenantBranding.primaryColor),
    secondaryColor: normalizeHexColor(merged.secondaryColor, defaultTenantBranding.secondaryColor),
    accentColor: normalizeHexColor(merged.accentColor, defaultTenantBranding.accentColor),
    backgroundStyle: backgroundStyles.includes(merged.backgroundStyle) ? merged.backgroundStyle : defaultTenantBranding.backgroundStyle,
    backgroundColor: normalizeHexColor(merged.backgroundColor, defaultTenantBranding.backgroundColor),
    surfaceColor: normalizeHexColor(merged.surfaceColor, defaultTenantBranding.surfaceColor),
    textMode: textModes.includes(merged.textMode) ? merged.textMode : defaultTenantBranding.textMode,
    logoUrl: merged.logoUrl?.trim() || null,
    faviconUrl: merged.faviconUrl?.trim() || null,
    heroImageUrl: merged.heroImageUrl?.trim() || null,
    buttonStyle: buttonStyles.includes(merged.buttonStyle) ? merged.buttonStyle : defaultTenantBranding.buttonStyle,
    cardStyle: cardStyles.includes(merged.cardStyle) ? merged.cardStyle : defaultTenantBranding.cardStyle,
    navStyle: navStyles.includes(merged.navStyle) ? merged.navStyle : defaultTenantBranding.navStyle,
  };
}

export function applyBrandingPreset(
  current: TenantBrandingConfig,
  presetId: (typeof brandingPresets)[number]["id"],
) {
  const preset = brandingPresets.find((item) => item.id === presetId);
  if (!preset) {
    return current;
  }

  return normalizeTenantBrandingConfig({
    ...current,
    ...preset.config,
  });
}

export function parseTenantBrandingConfig(value: unknown, fallback?: Partial<TenantBrandingConfig>) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return normalizeTenantBrandingConfig(fallback);
  }

  return normalizeTenantBrandingConfig({
    ...(fallback ?? {}),
    ...(value as Partial<TenantBrandingConfig>),
  });
}

export function getBrandingPublishIssues(config: TenantBrandingConfig) {
  const issues: string[] = [];
  const appText = pickTextColor(config.surfaceColor, config.textMode);
  const appContrast = getContrastRatio(appText, config.surfaceColor);
  const brandContrast = getContrastRatio("#FFFFFF", config.primaryColor);

  if (appContrast < 4.5) {
    issues.push("Surface and text colors are too low contrast for app surfaces.");
  }

  if (brandContrast < 4.5) {
    issues.push("Primary color is too light for white text on buttons.");
  }

  if (config.backgroundStyle === "IMAGE_HERO" && !config.heroImageUrl) {
    issues.push("Hero image background requires a hero image URL.");
  }

  return issues;
}

function buildPublicBackground(config: TenantBrandingConfig) {
  switch (config.backgroundStyle) {
    case "LIGHT":
      return `linear-gradient(180deg, ${mixHexColors(config.backgroundColor, "#FFFFFF", 0.65)}, ${config.backgroundColor})`;
    case "DARK":
      return `linear-gradient(180deg, ${mixHexColors(config.secondaryColor, "#07111B", 0.45)}, ${mixHexColors(config.primaryColor, "#07111B", 0.15)})`;
    case "SOFT_GRADIENT":
      return `radial-gradient(circle at top, ${hexWithAlpha(config.primaryColor, 0.15)}, transparent 32%), linear-gradient(180deg, #FCFBF7, ${config.backgroundColor} 38%, ${mixHexColors(config.backgroundColor, "#F2EFE8", 0.4)})`;
    case "BRANDED_GRADIENT":
      return `linear-gradient(135deg, ${mixHexColors(config.primaryColor, "#FFFFFF", 0.1)}, ${mixHexColors(config.secondaryColor, "#0B1220", 0.2)} 58%, ${mixHexColors(config.accentColor, "#FFFFFF", 0.15)})`;
    case "IMAGE_HERO":
      return config.heroImageUrl
        ? `linear-gradient(180deg, ${hexWithAlpha("#07111B", 0.45)}, ${hexWithAlpha(config.primaryColor, 0.35)}), url(${config.heroImageUrl}) center/cover no-repeat`
        : `linear-gradient(180deg, ${mixHexColors(config.primaryColor, "#FFFFFF", 0.25)}, ${config.backgroundColor})`;
    case "CLEAN_APP_DEFAULT":
    default:
      return `radial-gradient(circle at top, ${hexWithAlpha(config.primaryColor, 0.08)}, transparent 30%), linear-gradient(180deg, #FCFBF7, ${config.backgroundColor} 35%, ${mixHexColors(config.backgroundColor, "#F4F1E8", 0.45)})`;
  }
}

function getRadius(buttonStyle: ButtonStyle, cardStyle: CardStyle) {
  const buttonRadius =
    buttonStyle === "PILL" ? "999px" : buttonStyle === "ROUNDED" ? "20px" : "14px";
  const cardRadius =
    cardStyle === "GLASS" ? "30px" : cardStyle === "OUTLINED" ? "24px" : "28px";

  return { buttonRadius, cardRadius };
}

export function buildTenantThemeStyles(
  config: TenantBrandingConfig,
  surface: "public" | "app",
): { style: CSSProperties; classes: string; meta: { headingColor: string; mutedColor: string } } {
  const normalized = normalizeTenantBrandingConfig(config);
  const textColor = pickTextColor(normalized.backgroundColor, normalized.textMode);
  const headingColor = surface === "public" ? textColor : "#07111B";
  const mutedColor = surface === "public" ? hexWithAlpha(textColor, 0.72) : "#475569";
  const { buttonRadius, cardRadius } = getRadius(normalized.buttonStyle, normalized.cardStyle);
  const brand500 = mixHexColors(normalized.primaryColor, "#FFFFFF", 0.08);
  const brand700 = normalized.secondaryColor;
  const brand800 = mixHexColors(normalized.secondaryColor, "#07111B", 0.16);
  const line = surface === "public" ? hexWithAlpha(textColor, 0.12) : "rgba(15, 23, 42, 0.08)";
  const sand100 = surface === "public" ? hexWithAlpha(normalized.surfaceColor, 0.88) : mixHexColors(normalized.backgroundColor, "#F7F4ED", 0.42);
  const navSurface =
    normalized.navStyle === "SOLID"
      ? normalized.surfaceColor
      : normalized.navStyle === "MINIMAL"
        ? hexWithAlpha(normalized.surfaceColor, surface === "public" ? 0.58 : 0.92)
        : hexWithAlpha(normalized.surfaceColor, surface === "public" ? 0.8 : 0.97);
  const navBorder =
    normalized.navStyle === "MINIMAL"
      ? hexWithAlpha(surface === "public" ? textColor : "#0F172A", 0.08)
      : line;
  const navShadow =
    normalized.navStyle === "FLOATING"
      ? "0 18px 48px rgba(15,23,42,0.08)"
      : "none";

  const style = {
    "--brand-500": brand500,
    "--brand-700": brand700,
    "--brand-800": brand800,
    "--ink-500": mutedColor,
    "--ink-600": surface === "public" ? hexWithAlpha(headingColor, 0.82) : "#475569",
    "--ink-700": surface === "public" ? hexWithAlpha(headingColor, 0.92) : "#334155",
    "--ink-900": headingColor,
    "--ink-950": headingColor,
    "--sand-100": sand100,
    "--sand-200": mixHexColors(normalized.surfaceColor, normalized.accentColor, 0.08),
    "--line": line,
    "--tenant-background": surface === "public" ? normalized.backgroundColor : mixHexColors(normalized.backgroundColor, "#F7F5EE", 0.42),
    "--tenant-surface": normalized.surfaceColor,
    "--tenant-accent": normalized.accentColor,
    "--tenant-primary": normalized.primaryColor,
    "--tenant-secondary": normalized.secondaryColor,
    "--tenant-nav-surface": navSurface,
    "--tenant-nav-border": navBorder,
    "--tenant-nav-shadow": navShadow,
    "--tenant-button-radius": buttonRadius,
    "--tenant-card-radius": cardRadius,
    background: surface === "public"
      ? buildPublicBackground(normalized)
      : `radial-gradient(circle at top, ${hexWithAlpha(normalized.primaryColor, 0.08)}, transparent 28%), linear-gradient(180deg, #FCFBF7, ${mixHexColors(normalized.backgroundColor, "#F4F1E8", 0.28)})`,
    color: surface === "public" ? textColor : "#0F172A",
  } as CSSProperties;

  const classes =
    surface === "public"
      ? "min-h-screen [--tenant-surface-overlay:rgba(255,255,255,0.78)]"
      : "min-h-screen bg-[var(--tenant-background)]";

  return {
    style,
    classes,
    meta: {
      headingColor,
      mutedColor,
    },
  };
}

export function resolveBrandingState(input: {
  draft?: Partial<TenantBrandingConfig> | null;
  published?: Partial<TenantBrandingConfig> | null;
  fallback?: Partial<TenantBrandingConfig> | null;
  publishedAt?: Date | string | null;
}): TenantBrandingState {
  const published = parseTenantBrandingConfig(input.published, input.fallback ?? undefined);
  const draft = parseTenantBrandingConfig(input.draft, published);
  return {
    draft,
    published,
    publishedAt:
      input.publishedAt instanceof Date
        ? input.publishedAt.toISOString()
        : typeof input.publishedAt === "string"
          ? input.publishedAt
          : null,
    isDirty: JSON.stringify(draft) !== JSON.stringify(published),
  };
}
