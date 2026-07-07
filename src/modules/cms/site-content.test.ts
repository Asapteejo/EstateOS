import assert from "node:assert/strict";
import test from "node:test";

import { resolveTenantSiteContent } from "@/modules/cms/site-content";
import { siteContentSchema } from "@/lib/validations/site-content";

test("site content falls back to company-derived copy when nothing is stored", () => {
  const content = resolveTenantSiteContent({
    companyName: "Acme Realty",
    startPurchaseHref: "/auth/purchase",
  });

  assert.equal(content.hero.eyebrow, "Trusted property transactions");
  assert.match(content.hero.headline, /Acme Realty/);
  assert.equal(content.hero.primaryCta.href, "/properties");
  assert.equal(content.hero.secondaryCta.href, "/auth/purchase");
  assert.match(content.about.title, /Acme Realty/);
  assert.ok(content.footer.tagline.length > 0);
  // New surfaces all have non-empty fallbacks…
  assert.match(content.seo.title, /Acme Realty/);
  assert.ok(content.seo.description.length > 0);
  assert.ok(content.heroStats.inventoryLabel.length > 0);
  assert.match(content.heroPanel.badge, /Acme Realty/);
  assert.equal(content.journey.steps.length, 3);
  assert.ok(content.sections.featured.title.length > 0);
  assert.ok(content.contact.hours.length > 0);
  // …except socials, which stay empty (hidden) until the tenant adds them.
  assert.equal(content.social.facebook, "");
  assert.equal(content.social.whatsapp, "");
});

test("stored content overrides fallbacks field by field", () => {
  const content = resolveTenantSiteContent({
    companyName: "Acme Realty",
    startPurchaseHref: "/auth/purchase",
    stored: {
      hero: {
        headline: "Find your next home with confidence.",
        primaryCta: { label: "Browse homes" },
      },
      heroStats: { inventoryLabel: "Estates selling now" },
      journey: { steps: [{ title: "Pick your estate" }] },
      sections: { featured: { title: "This month's best homes" } },
      social: { instagram: "https://instagram.com/acmerealty", whatsapp: "+2348012345678" },
      footer: { tagline: "Lagos' most trusted developer." },
    },
  });

  // Overridden fields take the stored value...
  assert.equal(content.hero.headline, "Find your next home with confidence.");
  assert.equal(content.hero.primaryCta.label, "Browse homes");
  assert.equal(content.heroStats.inventoryLabel, "Estates selling now");
  assert.equal(content.journey.steps[0].title, "Pick your estate");
  assert.equal(content.sections.featured.title, "This month's best homes");
  assert.equal(content.social.instagram, "https://instagram.com/acmerealty");
  assert.equal(content.social.whatsapp, "+2348012345678");
  assert.equal(content.footer.tagline, "Lagos' most trusted developer.");
  // ...while unspecified fields keep their fallbacks.
  assert.equal(content.hero.eyebrow, "Trusted property transactions");
  assert.equal(content.hero.primaryCta.href, "/properties");
  assert.ok(content.journey.steps[0].description.length > 0);
  assert.ok(content.journey.steps[1].title.length > 0);
  assert.ok(content.heroStats.marketersLabel.length > 0);
  assert.equal(content.social.facebook, "");
});

test("blank stored strings fall back instead of rendering empty copy", () => {
  const content = resolveTenantSiteContent({
    companyName: "Acme Realty",
    startPurchaseHref: "/auth/purchase",
    stored: {
      hero: { headline: "   ", subhead: "" },
      heroPanel: { title: "  " },
      contact: { hours: "" },
    },
  });

  assert.match(content.hero.headline, /Acme Realty/);
  assert.ok(content.hero.subhead.length > 0);
  assert.ok(content.heroPanel.title.length > 0);
  assert.ok(content.contact.hours.length > 0);
});

test("site content schema rejects unsafe CTA links and overlong copy", () => {
  assert.equal(
    siteContentSchema.safeParse({ hero: { primaryCta: { href: "javascript:alert(1)" } } }).success,
    false,
  );
  assert.equal(
    siteContentSchema.safeParse({ hero: { headline: "x".repeat(500) } }).success,
    false,
  );
  assert.equal(
    siteContentSchema.safeParse({
      hero: { headline: "Clean headline", primaryCta: { label: "Go", href: "/properties" } },
      footer: { tagline: "Trusted." },
    }).success,
    true,
  );
});

test("social links must be https and whatsapp must be E.164", () => {
  assert.equal(
    siteContentSchema.safeParse({ social: { facebook: "http://facebook.com/x" } }).success,
    false,
  );
  assert.equal(
    siteContentSchema.safeParse({ social: { facebook: "javascript:alert(1)" } }).success,
    false,
  );
  assert.equal(
    siteContentSchema.safeParse({ social: { whatsapp: "0801 234 5678" } }).success,
    false,
  );
  assert.equal(
    siteContentSchema.safeParse({
      social: { facebook: "https://facebook.com/acme", whatsapp: "+2348012345678" },
    }).success,
    true,
  );
  // Blank socials are fine — they simply hide the icon.
  assert.equal(siteContentSchema.safeParse({ social: { facebook: "" } }).success, true);
});

test("careers page is visible by default, hideable, and fully editable", () => {
  const defaults = resolveTenantSiteContent({
    companyName: "Acme Realty",
    startPurchaseHref: "/auth/purchase",
  });
  assert.equal(defaults.careers.visible, true);
  assert.match(defaults.careers.title, /Acme Realty/);
  assert.equal(defaults.careers.values.length, 3);
  // Fallback copy must speak for the TENANT, never the platform.
  assert.ok(!defaults.careers.intro.includes("operating system"));

  const hidden = resolveTenantSiteContent({
    companyName: "Acme Realty",
    startPurchaseHref: "/auth/purchase",
    stored: { careers: { visible: false } },
  });
  assert.equal(hidden.careers.visible, false);

  const edited = resolveTenantSiteContent({
    companyName: "Acme Realty",
    startPurchaseHref: "/auth/purchase",
    stored: {
      careers: {
        title: "Join our Lekki sales team.",
        values: [{ title: "Commission that rewards hustle" }],
        ctaLabel: "Apply now",
      },
    },
  });
  assert.equal(edited.careers.visible, true);
  assert.equal(edited.careers.title, "Join our Lekki sales team.");
  assert.equal(edited.careers.values[0].title, "Commission that rewards hustle");
  assert.ok(edited.careers.values[0].description.length > 0);
  assert.equal(edited.careers.ctaLabel, "Apply now");

  // Schema: visible must be a boolean; copy is bounded.
  assert.equal(
    siteContentSchema.safeParse({ careers: { visible: "yes" } }).success,
    false,
  );
  assert.equal(
    siteContentSchema.safeParse({ careers: { visible: false, title: "We're hiring" } }).success,
    true,
  );
});

test("journey accepts at most three steps and bounded copy", () => {
  assert.equal(
    siteContentSchema.safeParse({
      journey: { steps: [{}, {}, {}, {}] },
    }).success,
    false,
  );
  assert.equal(
    siteContentSchema.safeParse({
      journey: {
        heading: "How buying works",
        steps: [{ title: "Find", description: "Browse verified homes." }],
      },
      seo: { title: "Acme Realty — Homes in Lekki", description: "Verified homes in Lekki." },
    }).success,
    true,
  );
});
