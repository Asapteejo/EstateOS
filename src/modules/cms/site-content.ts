/**
 * Tenant site content resolver.
 *
 * Centralizes the *editable text* of a tenant's public marketing site (hero,
 * footer, about) behind one typed shape with sensible, company-derived
 * fallbacks. Components read from the resolved object, never from hardcoded
 * strings — so the same render path serves both the default copy today and
 * tenant-authored copy once the CMS editor lands.
 *
 * Phase 2 (now): callers resolve with `stored: undefined`, so every field uses
 * its fallback and the live site looks identical to before.
 *
 * Phase 3 (CMS): the admin editor persists a partial override (validated, with
 * draft → publish), the public render passes it in as `stored`, and only the
 * fields the tenant actually edited change. Nothing in the components changes.
 */

export type CtaLink = { label: string; href: string };

export type TenantSiteContent = {
  hero: {
    eyebrow: string;
    headline: string;
    subhead: string;
    primaryCta: CtaLink;
    secondaryCta: CtaLink;
  };
  footer: {
    tagline: string;
  };
  about: {
    eyebrow: string;
    title: string;
    intro: string;
  };
};

/** Partial, all-optional override shape the CMS will persist and pass back in. */
export type StoredSiteContent = {
  hero?: Partial<{
    eyebrow: string;
    headline: string;
    subhead: string;
    primaryCta: Partial<CtaLink>;
    secondaryCta: Partial<CtaLink>;
  }>;
  footer?: Partial<{ tagline: string }>;
  about?: Partial<{ eyebrow: string; title: string; intro: string }>;
};

/** Use the stored value only when it is a non-empty trimmed string. */
function pick(stored: string | undefined, fallback: string): string {
  const value = typeof stored === "string" ? stored.trim() : "";
  return value.length > 0 ? value : fallback;
}

function pickCta(stored: Partial<CtaLink> | undefined, fallback: CtaLink): CtaLink {
  return {
    label: pick(stored?.label, fallback.label),
    href: pick(stored?.href, fallback.href),
  };
}

export function resolveTenantSiteContent(args: {
  companyName: string;
  description?: string | null;
  startPurchaseHref: string;
  stored?: StoredSiteContent | null;
}): TenantSiteContent {
  const { companyName, description, startPurchaseHref, stored } = args;
  const trimmedDescription = description?.trim();

  const fallback: TenantSiteContent = {
    hero: {
      eyebrow: "Trusted property transactions",
      headline: `${companyName} brings discovery, trust, and transaction visibility into one property journey.`,
      subhead:
        "Browse verified listings, work with trusted marketers, and move from first interest to reservation and payment through a branded, tenant-scoped experience.",
      primaryCta: { label: "View properties", href: "/properties" },
      secondaryCta: { label: "Start purchase", href: startPurchaseHref },
    },
    footer: {
      tagline:
        "A modern real estate experience for high-trust property discovery, reservations, payments, and transaction visibility.",
    },
    about: {
      eyebrow: "About",
      title: `Built for the way ${companyName} sells property.`,
      intro:
        trimmedDescription && trimmedDescription.length > 0
          ? trimmedDescription
          : `${companyName} runs verified listings, trusted marketer attribution, and a clear path from first inquiry to receipt — all on one branded platform.`,
    },
  };

  return {
    hero: {
      eyebrow: pick(stored?.hero?.eyebrow, fallback.hero.eyebrow),
      headline: pick(stored?.hero?.headline, fallback.hero.headline),
      subhead: pick(stored?.hero?.subhead, fallback.hero.subhead),
      primaryCta: pickCta(stored?.hero?.primaryCta, fallback.hero.primaryCta),
      secondaryCta: pickCta(stored?.hero?.secondaryCta, fallback.hero.secondaryCta),
    },
    footer: {
      tagline: pick(stored?.footer?.tagline, fallback.footer.tagline),
    },
    about: {
      eyebrow: pick(stored?.about?.eyebrow, fallback.about.eyebrow),
      title: pick(stored?.about?.title, fallback.about.title),
      intro: pick(stored?.about?.intro, fallback.about.intro),
    },
  };
}
