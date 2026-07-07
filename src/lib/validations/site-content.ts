import { z } from "zod";

/**
 * Validation for tenant-authored marketing copy — the full public site:
 * SEO, hero (+ stat cards + side panel), buyer journey, section headings,
 * about, contact extras, social links, footer.
 *
 * Every field is optional: an empty or omitted field falls back to the
 * company-derived default in `resolveTenantSiteContent`, so a tenant only
 * overrides what they actually want to change. Lengths are bounded to keep
 * the layout intact, and links are constrained to internal paths or safe URL
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

/** Social profile links: full https URLs only (or blank to hide). */
const optionalSocialUrl = z
  .string()
  .trim()
  .max(512)
  .optional()
  .refine(
    (value) => !value || /^https:\/\//i.test(value),
    "Use a full https:// link, or leave blank to hide the icon.",
  );

/** WhatsApp number in international format, or blank to hide. */
const optionalWhatsAppNumber = z
  .string()
  .trim()
  .max(20)
  .optional()
  .refine(
    (value) => !value || /^\+[1-9]\d{7,14}$/.test(value),
    "Use international format, e.g. +2348012345678, or leave blank.",
  );

const ctaSchema = z
  .object({
    label: optionalText(40),
    href: optionalHref,
  })
  .optional();

const journeyStepSchema = z
  .object({
    title: optionalText(60),
    description: optionalText(240),
  })
  .optional();

const sectionHeadingSchema = z
  .object({
    eyebrow: optionalText(60),
    title: optionalText(160),
    description: optionalText(300),
  })
  .optional();

export const siteContentSchema = z.object({
  seo: z
    .object({
      title: optionalText(70),
      description: optionalText(170),
    })
    .optional(),
  hero: z
    .object({
      eyebrow: optionalText(60),
      headline: optionalText(160),
      subhead: optionalText(400),
      primaryCta: ctaSchema,
      secondaryCta: ctaSchema,
    })
    .optional(),
  heroStats: z
    .object({
      inventoryLabel: optionalText(40),
      inventoryNote: optionalText(200),
      marketersLabel: optionalText(40),
      marketersNote: optionalText(200),
      trustLabel: optionalText(40),
      trustNote: optionalText(200),
    })
    .optional(),
  heroPanel: z
    .object({
      badge: optionalText(60),
      title: optionalText(160),
      body: optionalText(300),
    })
    .optional(),
  journey: z
    .object({
      heading: optionalText(80),
      steps: z.array(journeyStepSchema).max(3).optional(),
    })
    .optional(),
  sections: z
    .object({
      featured: sectionHeadingSchema,
      marketers: z
        .object({
          title: optionalText(160),
          description: optionalText(300),
        })
        .optional(),
      testimonials: sectionHeadingSchema,
    })
    .optional(),
  about: z
    .object({
      eyebrow: optionalText(60),
      title: optionalText(160),
      intro: optionalText(600),
    })
    .optional(),
  careers: z
    .object({
      visible: z.boolean().optional(),
      eyebrow: optionalText(60),
      title: optionalText(160),
      intro: optionalText(400),
      values: z.array(journeyStepSchema).max(3).optional(),
      ctaHeading: optionalText(80),
      ctaBody: optionalText(300),
      ctaLabel: optionalText(40),
    })
    .optional(),
  contact: z
    .object({
      hours: optionalText(120),
      note: optionalText(240),
    })
    .optional(),
  social: z
    .object({
      facebook: optionalSocialUrl,
      instagram: optionalSocialUrl,
      twitter: optionalSocialUrl,
      linkedin: optionalSocialUrl,
      tiktok: optionalSocialUrl,
      whatsapp: optionalWhatsAppNumber,
    })
    .optional(),
  footer: z
    .object({
      tagline: optionalText(400),
    })
    .optional(),
});

export type SiteContentInput = z.infer<typeof siteContentSchema>;

export const siteContentActionSchema = z.object({
  action: z.enum(["publish", "reset"]),
});
