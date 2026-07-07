/**
 * Tenant site content resolver.
 *
 * Centralizes ALL editable text of a tenant's public marketing site behind
 * one typed shape with sensible, company-derived fallbacks. Components read
 * from the resolved object, never from hardcoded strings — every tenant can
 * make the site sound like *their* company without touching code.
 *
 * Coverage: SEO metadata, hero (copy + stat cards + side panel), the
 * three-step buyer journey, homepage section headings, about intro, contact
 * extras (hours/note), social links, and the footer tagline.
 *
 * Resolution rule: a stored field is used only when it is a non-empty
 * trimmed string; anything blank falls back field-by-field, so tenants only
 * override what they actually edit.
 */

export type CtaLink = { label: string; href: string };

export type JourneyStep = { title: string; description: string };

export type SectionHeading = { eyebrow: string; title: string; description: string };

export type TenantSiteContent = {
  seo: {
    title: string;
    description: string;
  };
  hero: {
    eyebrow: string;
    headline: string;
    subhead: string;
    primaryCta: CtaLink;
    secondaryCta: CtaLink;
  };
  /** Copy for the three live-number stat cards under the hero. */
  heroStats: {
    inventoryLabel: string;
    inventoryNote: string;
    marketersLabel: string;
    marketersNote: string;
    trustLabel: string;
    trustNote: string;
  };
  /** The image-side panel next to the hero. */
  heroPanel: {
    badge: string;
    title: string;
    body: string;
  };
  /** "How it works" — the three-step buyer journey. */
  journey: {
    heading: string;
    steps: [JourneyStep, JourneyStep, JourneyStep];
  };
  sections: {
    featured: SectionHeading;
    marketers: { title: string; description: string };
    testimonials: SectionHeading;
  };
  about: {
    eyebrow: string;
    title: string;
    intro: string;
  };
  /** Careers page — hideable for companies that aren't hiring. */
  careers: {
    visible: boolean;
    eyebrow: string;
    title: string;
    intro: string;
    values: [JourneyStep, JourneyStep, JourneyStep];
    ctaHeading: string;
    ctaBody: string;
    ctaLabel: string;
  };
  contact: {
    hours: string;
    note: string;
  };
  /** Empty string = link hidden. whatsapp holds a phone number in E.164. */
  social: {
    facebook: string;
    instagram: string;
    twitter: string;
    linkedin: string;
    tiktok: string;
    whatsapp: string;
  };
  footer: {
    tagline: string;
  };
};

/** Partial, all-optional override shape the CMS persists and passes back in. */
export type StoredSiteContent = {
  seo?: Partial<{ title: string; description: string }>;
  hero?: Partial<{
    eyebrow: string;
    headline: string;
    subhead: string;
    primaryCta: Partial<CtaLink>;
    secondaryCta: Partial<CtaLink>;
  }>;
  heroStats?: Partial<TenantSiteContent["heroStats"]>;
  heroPanel?: Partial<TenantSiteContent["heroPanel"]>;
  journey?: {
    heading?: string;
    steps?: Array<Partial<JourneyStep> | undefined>;
  };
  sections?: {
    featured?: Partial<SectionHeading>;
    marketers?: Partial<{ title: string; description: string }>;
    testimonials?: Partial<SectionHeading>;
  };
  about?: Partial<{ eyebrow: string; title: string; intro: string }>;
  careers?: {
    visible?: boolean;
    eyebrow?: string;
    title?: string;
    intro?: string;
    values?: Array<Partial<JourneyStep> | undefined>;
    ctaHeading?: string;
    ctaBody?: string;
    ctaLabel?: string;
  };
  contact?: Partial<{ hours: string; note: string }>;
  social?: Partial<TenantSiteContent["social"]>;
  footer?: Partial<{ tagline: string }>;
};

/** Use the stored value only when it is a non-empty trimmed string. */
function pick(stored: string | undefined, fallback: string): string {
  const value = typeof stored === "string" ? stored.trim() : "";
  return value.length > 0 ? value : fallback;
}

/** Like pick, but empty/absent stays empty (for optional links like socials). */
function pickOptional(stored: string | undefined): string {
  return typeof stored === "string" ? stored.trim() : "";
}

function pickCta(stored: Partial<CtaLink> | undefined, fallback: CtaLink): CtaLink {
  return {
    label: pick(stored?.label, fallback.label),
    href: pick(stored?.href, fallback.href),
  };
}

function pickStep(
  stored: Partial<JourneyStep> | undefined,
  fallback: JourneyStep,
): JourneyStep {
  return {
    title: pick(stored?.title, fallback.title),
    description: pick(stored?.description, fallback.description),
  };
}

function pickHeading(
  stored: Partial<SectionHeading> | undefined,
  fallback: SectionHeading,
): SectionHeading {
  return {
    eyebrow: pick(stored?.eyebrow, fallback.eyebrow),
    title: pick(stored?.title, fallback.title),
    description: pick(stored?.description, fallback.description),
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
    seo: {
      title: `${companyName} — Verified property listings`,
      description:
        trimmedDescription ||
        `Browse verified listings from ${companyName}, book inspections, and buy your next property with confidence.`,
    },
    hero: {
      eyebrow: "Trusted property transactions",
      headline: `Find your next home with ${companyName}.`,
      subhead:
        "Browse verified listings, book inspections with our team, and move from first viewing to keys in hand — with clear pricing and no surprises.",
      primaryCta: { label: "View properties", href: "/properties" },
      secondaryCta: { label: "Start purchase", href: startPurchaseHref },
    },
    heroStats: {
      inventoryLabel: "Homes available",
      inventoryNote: "Every listing is verified by our team before it goes live — no stale or hidden inventory.",
      marketersLabel: "Expert marketers",
      marketersNote: "Meet the people who will walk you from first viewing to handover.",
      trustLabel: "Happy clients",
      trustNote: "Real stories from buyers who completed their purchase with us.",
    },
    heroPanel: {
      badge: `Why buy with ${companyName}`,
      title: "Verified listings, transparent pricing, and support at every step.",
      body: "From your first viewing to your final payment, you always know exactly where your purchase stands.",
    },
    journey: {
      heading: "How it works",
      steps: [
        {
          title: "Find your property",
          description:
            "Browse verified listings, book inspections, and shortlist the homes you love.",
        },
        {
          title: "Reserve with confidence",
          description:
            "Secure your chosen property with a reservation and a payment plan that fits.",
        },
        {
          title: "Move in with peace of mind",
          description:
            "Track payments, sign your documents, and collect your keys — all in one place.",
        },
      ],
    },
    sections: {
      featured: {
        eyebrow: "Featured Properties",
        title: "Homes worth seeing first.",
        description:
          "Hand-picked listings from our newest and most sought-after inventory.",
      },
      marketers: {
        title: "Meet the team moving deals forward",
        description:
          "Our marketers guide you from first viewing to handover — pick one and start a conversation.",
      },
      testimonials: {
        eyebrow: "Testimonials",
        title: "Clients remember the process as much as the property.",
        description: `Real feedback from buyers who completed their journey with ${companyName}.`,
      },
    },
    about: {
      eyebrow: `About ${companyName}`,
      title: `${companyName} exists to make property ownership simple, safe, and transparent.`,
      intro:
        trimmedDescription ||
        `${companyName} helps buyers find verified properties, understand exactly what they are paying for, and complete their purchase with a team they can trust.`,
    },
    careers: {
      visible: true,
      eyebrow: "Careers & Partnerships",
      title: `Grow your career with ${companyName}.`,
      intro:
        "We work with marketers, agents, and partners who care about doing right by buyers. If that sounds like you, we'd love to hear from you.",
      values: [
        {
          title: "Real ownership",
          description:
            "Your work directly helps families find and secure their homes — you see the impact of every deal you close.",
        },
        {
          title: "Trust by default",
          description:
            "We win by making property transactions feel safe and transparent — for buyers and for the people who work with us.",
        },
        {
          title: "Room to grow",
          description:
            "Top marketers here build a name, a client base, and an income that grows with every successful handover.",
        },
      ],
      ctaHeading: "Want to work with us?",
      ctaBody:
        "Tell us how you'd like to contribute — as a marketer, agent, or partner — and we'll get back to you.",
      ctaLabel: "Introduce yourself",
    },
    contact: {
      hours: "Mon – Fri, 9:00 – 17:00",
      note: "Prefer WhatsApp? Message us any time — we usually reply within the hour.",
    },
    social: {
      facebook: "",
      instagram: "",
      twitter: "",
      linkedin: "",
      tiktok: "",
      whatsapp: "",
    },
    footer: {
      tagline:
        trimmedDescription ||
        `${companyName} — verified listings, honest guidance, and a property journey you can track from start to finish.`,
    },
  };

  if (!stored) {
    return fallback;
  }

  return {
    seo: {
      title: pick(stored.seo?.title, fallback.seo.title),
      description: pick(stored.seo?.description, fallback.seo.description),
    },
    hero: {
      eyebrow: pick(stored.hero?.eyebrow, fallback.hero.eyebrow),
      headline: pick(stored.hero?.headline, fallback.hero.headline),
      subhead: pick(stored.hero?.subhead, fallback.hero.subhead),
      primaryCta: pickCta(stored.hero?.primaryCta, fallback.hero.primaryCta),
      secondaryCta: pickCta(stored.hero?.secondaryCta, fallback.hero.secondaryCta),
    },
    heroStats: {
      inventoryLabel: pick(stored.heroStats?.inventoryLabel, fallback.heroStats.inventoryLabel),
      inventoryNote: pick(stored.heroStats?.inventoryNote, fallback.heroStats.inventoryNote),
      marketersLabel: pick(stored.heroStats?.marketersLabel, fallback.heroStats.marketersLabel),
      marketersNote: pick(stored.heroStats?.marketersNote, fallback.heroStats.marketersNote),
      trustLabel: pick(stored.heroStats?.trustLabel, fallback.heroStats.trustLabel),
      trustNote: pick(stored.heroStats?.trustNote, fallback.heroStats.trustNote),
    },
    heroPanel: {
      badge: pick(stored.heroPanel?.badge, fallback.heroPanel.badge),
      title: pick(stored.heroPanel?.title, fallback.heroPanel.title),
      body: pick(stored.heroPanel?.body, fallback.heroPanel.body),
    },
    journey: {
      heading: pick(stored.journey?.heading, fallback.journey.heading),
      steps: [
        pickStep(stored.journey?.steps?.[0], fallback.journey.steps[0]),
        pickStep(stored.journey?.steps?.[1], fallback.journey.steps[1]),
        pickStep(stored.journey?.steps?.[2], fallback.journey.steps[2]),
      ],
    },
    sections: {
      featured: pickHeading(stored.sections?.featured, fallback.sections.featured),
      marketers: {
        title: pick(stored.sections?.marketers?.title, fallback.sections.marketers.title),
        description: pick(
          stored.sections?.marketers?.description,
          fallback.sections.marketers.description,
        ),
      },
      testimonials: pickHeading(stored.sections?.testimonials, fallback.sections.testimonials),
    },
    about: {
      eyebrow: pick(stored.about?.eyebrow, fallback.about.eyebrow),
      title: pick(stored.about?.title, fallback.about.title),
      intro: pick(stored.about?.intro, fallback.about.intro),
    },
    careers: {
      // Only an explicit false hides the page; anything else keeps it visible.
      visible: stored.careers?.visible === false ? false : true,
      eyebrow: pick(stored.careers?.eyebrow, fallback.careers.eyebrow),
      title: pick(stored.careers?.title, fallback.careers.title),
      intro: pick(stored.careers?.intro, fallback.careers.intro),
      values: [
        pickStep(stored.careers?.values?.[0], fallback.careers.values[0]),
        pickStep(stored.careers?.values?.[1], fallback.careers.values[1]),
        pickStep(stored.careers?.values?.[2], fallback.careers.values[2]),
      ],
      ctaHeading: pick(stored.careers?.ctaHeading, fallback.careers.ctaHeading),
      ctaBody: pick(stored.careers?.ctaBody, fallback.careers.ctaBody),
      ctaLabel: pick(stored.careers?.ctaLabel, fallback.careers.ctaLabel),
    },
    contact: {
      hours: pick(stored.contact?.hours, fallback.contact.hours),
      note: pick(stored.contact?.note, fallback.contact.note),
    },
    social: {
      facebook: pickOptional(stored.social?.facebook),
      instagram: pickOptional(stored.social?.instagram),
      twitter: pickOptional(stored.social?.twitter),
      linkedin: pickOptional(stored.social?.linkedin),
      tiktok: pickOptional(stored.social?.tiktok),
      whatsapp: pickOptional(stored.social?.whatsapp),
    },
    footer: {
      tagline: pick(stored.footer?.tagline, fallback.footer.tagline),
    },
  };
}
