import { z } from "zod";

import {
  backgroundStyles,
  buttonStyles,
  cardStyles,
  navStyles,
  textModes,
} from "@/modules/branding/theme";

const optionalUrl = z.string().trim().url().optional().or(z.literal("")).transform((value) => value || undefined);
const hexColor = z.string().trim().regex(/^#([0-9a-fA-F]{6})$/, "Use a full 6-digit hex color.");

export const brandingConfigSchema = z.object({
  primaryColor: hexColor,
  secondaryColor: hexColor,
  accentColor: hexColor,
  backgroundStyle: z.enum(backgroundStyles),
  backgroundColor: hexColor,
  surfaceColor: hexColor,
  textMode: z.enum(textModes),
  logoUrl: optionalUrl,
  faviconUrl: optionalUrl,
  heroImageUrl: optionalUrl,
  buttonStyle: z.enum(buttonStyles),
  cardStyle: z.enum(cardStyles),
  navStyle: z.enum(navStyles),
});

export const brandingActionSchema = z.object({
  action: z.enum(["publish", "reset"]),
});

export type BrandingConfigInput = z.infer<typeof brandingConfigSchema>;
