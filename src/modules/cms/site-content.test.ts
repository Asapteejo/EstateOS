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
  assert.match(content.hero.headline, /^Acme Realty brings discovery/);
  assert.equal(content.hero.primaryCta.href, "/properties");
  assert.equal(content.hero.secondaryCta.href, "/auth/purchase");
  assert.match(content.about.title, /Acme Realty/);
  assert.ok(content.footer.tagline.length > 0);
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
      footer: { tagline: "Lagos' most trusted developer." },
    },
  });

  // Overridden fields take the stored value...
  assert.equal(content.hero.headline, "Find your next home with confidence.");
  assert.equal(content.hero.primaryCta.label, "Browse homes");
  assert.equal(content.footer.tagline, "Lagos' most trusted developer.");
  // ...while unspecified fields keep their fallbacks.
  assert.equal(content.hero.eyebrow, "Trusted property transactions");
  assert.equal(content.hero.primaryCta.href, "/properties");
});

test("blank stored strings fall back instead of rendering empty copy", () => {
  const content = resolveTenantSiteContent({
    companyName: "Acme Realty",
    startPurchaseHref: "/auth/purchase",
    stored: { hero: { headline: "   ", subhead: "" } },
  });

  assert.match(content.hero.headline, /Acme Realty brings discovery/);
  assert.ok(content.hero.subhead.length > 0);
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
