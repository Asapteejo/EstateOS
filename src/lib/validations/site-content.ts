import { z } from "zod";

/**
 * Validation for tenant-authored marketing copy (hero / footer / about).
 *
 * Every field is optional: an empty or omitted field falls back to the
 * company-derived default in `resolveTenantSiteContent`, so a tenant only
 * overrides what they actually want to change. Lengths are bounded to keep the
 * layout intact, and CTA links are constrained to internal paths or safe URL
 * schemes (no javascript:, data:, etc.).
 */

const optionalText = (max: number) => z.string().trim().max(max).optional();

const optionalHref = z
  .string()
  .trim()
  .max(512)
  .optional()
  .refine(
    (value) => !value || value.startsWith("/") || /^(https?:|mailto:|tel:)/i.test(value),
    "Use an internal path starting with / or a full https/mailto/tel URL.",
  );

const ctaSchema = z
  .object({
    label: optionalText(40),
    href: optionalHref,
  })
  .optional();

export const siteContentSchema = z.object({
  hero: z
    .object({
      eyebrow: optionalText(60),
      headline: optionalText(160),
      subhead: optionalText(400),
      primaryCta: ctaSchema,
      secondaryCta: ctaSchema,
    })
    .optional(),
  footer: z
    .object({
      tagline: optionalText(400),
    })
    .optional(),
  about: z
    .object({
      eyebrow: optionalText(60),
      title: optionalText(160),
      intro: optionalText(600),
    })
    .optional(),
});

export type SiteContentInput = z.infer<typeof siteContentSchema>;

export const siteContentActionSchema = z.object({
  action: z.enum(["publish", "reset"]),
});
