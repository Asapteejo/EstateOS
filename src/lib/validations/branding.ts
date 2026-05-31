import { z } from "zod";

import {
  backgroundStyles,
  buttonStyles,
  cardStyles,
  navStyles,
  textModes,
} from "@/modules/branding/theme";

const optionalAssetRef = z.preprocess(
  (value) => (value === null ? "" : value),
  z.string().trim().optional().or(z.literal("")).transform((value) => value || undefined).refine((value) => {
    if (!value) {
      return true;
    }

    if (/^(https?:|data:|blob:)/i.test(value) || value.startsWith("/")) {
      return true;
    }

    return !/[<>\\\r\n]/.test(value) && !/^[a-z][a-z0-9+.-]*:/i.test(value);
  }, "Use a valid public asset URL or tenant storage key."),
);
const hexColor = z.string().trim().regex(/^#([0-9a-fA-F]{6})$/, "Use a full 6-digit hex color.");

export const brandingConfigSchema = z.object({
  primaryColor: hexColor,
  secondaryColor: hexColor,
  accentColor: hexColor,
  backgroundStyle: z.enum(backgroundStyles),
  backgroundColor: hexColor,
  surfaceColor: hexColor,
  textMode: z.enum(textModes),
  logoUrl: optionalAssetRef,
  faviconUrl: optionalAssetRef,
  heroImageUrl: optionalAssetRef,
  buttonStyle: z.enum(buttonStyles),
  cardStyle: z.enum(cardStyles),
  navStyle: z.enum(navStyles),
});

export const brandingActionSchema = z.object({
  action: z.enum(["publish", "reset"]),
});

export type BrandingConfigInput = z.infer<typeof brandingConfigSchema>;
