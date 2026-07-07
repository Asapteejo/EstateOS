"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatStableDate } from "@/lib/utils";
import type { TenantSiteContent } from "@/modules/cms/site-content";
import type { TenantSiteContentState } from "@/modules/cms/site-content-service";

/**
 * Full-site CMS editor: every piece of public marketing copy — SEO, hero
 * (+ stat cards + side panel), the buyer journey, section headings, about,
 * contact extras, social links, footer — with draft → publish control.
 * Blank fields fall back to smart company-derived defaults (shown as
 * placeholders), so tenants only override what they want to change.
 */

type DraftState = {
  seoTitle: string;
  seoDescription: string;
  heroEyebrow: string;
  heroHeadline: string;
  heroSubhead: string;
  heroPrimaryLabel: string;
  heroPrimaryHref: string;
  heroSecondaryLabel: string;
  heroSecondaryHref: string;
  statInventoryLabel: string;
  statInventoryNote: string;
  statMarketersLabel: string;
  statMarketersNote: string;
  statTrustLabel: string;
  statTrustNote: string;
  panelBadge: string;
  panelTitle: string;
  panelBody: string;
  journeyHeading: string;
  journeyStep1Title: string;
  journeyStep1Description: string;
  journeyStep2Title: string;
  journeyStep2Description: string;
  journeyStep3Title: string;
  journeyStep3Description: string;
  featuredEyebrow: string;
  featuredTitle: string;
  featuredDescription: string;
  marketersTitle: string;
  marketersDescription: string;
  testimonialsEyebrow: string;
  testimonialsTitle: string;
  testimonialsDescription: string;
  aboutEyebrow: string;
  aboutTitle: string;
  aboutIntro: string;
  careersVisible: boolean;
  careersEyebrow: string;
  careersTitle: string;
  careersIntro: string;
  careersValue1Title: string;
  careersValue1Description: string;
  careersValue2Title: string;
  careersValue2Description: string;
  careersValue3Title: string;
  careersValue3Description: string;
  careersCtaHeading: string;
  careersCtaBody: string;
  careersCtaLabel: string;
  contactHours: string;
  contactNote: string;
  socialFacebook: string;
  socialInstagram: string;
  socialTwitter: string;
  socialLinkedin: string;
  socialTiktok: string;
  socialWhatsapp: string;
  footerTagline: string;
};

/** Keys of DraftState whose values are strings (everything except toggles). */
type StringDraftKey = {
  [K in keyof DraftState]: DraftState[K] extends string ? K : never;
}[keyof DraftState];

function buildInitialDraft(state: TenantSiteContentState): DraftState {
  const { seo, hero, heroStats, heroPanel, journey, sections, about, careers, contact, social, footer } =
    state.draft;
  return {
    seoTitle: seo?.title ?? "",
    seoDescription: seo?.description ?? "",
    heroEyebrow: hero?.eyebrow ?? "",
    heroHeadline: hero?.headline ?? "",
    heroSubhead: hero?.subhead ?? "",
    heroPrimaryLabel: hero?.primaryCta?.label ?? "",
    heroPrimaryHref: hero?.primaryCta?.href ?? "",
    heroSecondaryLabel: hero?.secondaryCta?.label ?? "",
    heroSecondaryHref: hero?.secondaryCta?.href ?? "",
    statInventoryLabel: heroStats?.inventoryLabel ?? "",
    statInventoryNote: heroStats?.inventoryNote ?? "",
    statMarketersLabel: heroStats?.marketersLabel ?? "",
    statMarketersNote: heroStats?.marketersNote ?? "",
    statTrustLabel: heroStats?.trustLabel ?? "",
    statTrustNote: heroStats?.trustNote ?? "",
    panelBadge: heroPanel?.badge ?? "",
    panelTitle: heroPanel?.title ?? "",
    panelBody: heroPanel?.body ?? "",
    journeyHeading: journey?.heading ?? "",
    journeyStep1Title: journey?.steps?.[0]?.title ?? "",
    journeyStep1Description: journey?.steps?.[0]?.description ?? "",
    journeyStep2Title: journey?.steps?.[1]?.title ?? "",
    journeyStep2Description: journey?.steps?.[1]?.description ?? "",
    journeyStep3Title: journey?.steps?.[2]?.title ?? "",
    journeyStep3Description: journey?.steps?.[2]?.description ?? "",
    featuredEyebrow: sections?.featured?.eyebrow ?? "",
    featuredTitle: sections?.featured?.title ?? "",
    featuredDescription: sections?.featured?.description ?? "",
    marketersTitle: sections?.marketers?.title ?? "",
    marketersDescription: sections?.marketers?.description ?? "",
    testimonialsEyebrow: sections?.testimonials?.eyebrow ?? "",
    testimonialsTitle: sections?.testimonials?.title ?? "",
    testimonialsDescription: sections?.testimonials?.description ?? "",
    aboutEyebrow: about?.eyebrow ?? "",
    aboutTitle: about?.title ?? "",
    aboutIntro: about?.intro ?? "",
    careersVisible: careers?.visible !== false,
    careersEyebrow: careers?.eyebrow ?? "",
    careersTitle: careers?.title ?? "",
    careersIntro: careers?.intro ?? "",
    careersValue1Title: careers?.values?.[0]?.title ?? "",
    careersValue1Description: careers?.values?.[0]?.description ?? "",
    careersValue2Title: careers?.values?.[1]?.title ?? "",
    careersValue2Description: careers?.values?.[1]?.description ?? "",
    careersValue3Title: careers?.values?.[2]?.title ?? "",
    careersValue3Description: careers?.values?.[2]?.description ?? "",
    careersCtaHeading: careers?.ctaHeading ?? "",
    careersCtaBody: careers?.ctaBody ?? "",
    careersCtaLabel: careers?.ctaLabel ?? "",
    contactHours: contact?.hours ?? "",
    contactNote: contact?.note ?? "",
    socialFacebook: social?.facebook ?? "",
    socialInstagram: social?.instagram ?? "",
    socialTwitter: social?.twitter ?? "",
    socialLinkedin: social?.linkedin ?? "",
    socialTiktok: social?.tiktok ?? "",
    socialWhatsapp: social?.whatsapp ?? "",
    footerTagline: footer?.tagline ?? "",
  };
}

function buildPayload(draft: DraftState) {
  return {
    seo: { title: draft.seoTitle, description: draft.seoDescription },
    hero: {
      eyebrow: draft.heroEyebrow,
      headline: draft.heroHeadline,
      subhead: draft.heroSubhead,
      primaryCta: { label: draft.heroPrimaryLabel, href: draft.heroPrimaryHref },
      secondaryCta: { label: draft.heroSecondaryLabel, href: draft.heroSecondaryHref },
    },
    heroStats: {
      inventoryLabel: draft.statInventoryLabel,
      inventoryNote: draft.statInventoryNote,
      marketersLabel: draft.statMarketersLabel,
      marketersNote: draft.statMarketersNote,
      trustLabel: draft.statTrustLabel,
      trustNote: draft.statTrustNote,
    },
    heroPanel: {
      badge: draft.panelBadge,
      title: draft.panelTitle,
      body: draft.panelBody,
    },
    journey: {
      heading: draft.journeyHeading,
      steps: [
        { title: draft.journeyStep1Title, description: draft.journeyStep1Description },
        { title: draft.journeyStep2Title, description: draft.journeyStep2Description },
        { title: draft.journeyStep3Title, description: draft.journeyStep3Description },
      ],
    },
    sections: {
      featured: {
        eyebrow: draft.featuredEyebrow,
        title: draft.featuredTitle,
        description: draft.featuredDescription,
      },
      marketers: {
        title: draft.marketersTitle,
        description: draft.marketersDescription,
      },
      testimonials: {
        eyebrow: draft.testimonialsEyebrow,
        title: draft.testimonialsTitle,
        description: draft.testimonialsDescription,
      },
    },
    about: {
      eyebrow: draft.aboutEyebrow,
      title: draft.aboutTitle,
      intro: draft.aboutIntro,
    },
    careers: {
      visible: draft.careersVisible,
      eyebrow: draft.careersEyebrow,
      title: draft.careersTitle,
      intro: draft.careersIntro,
      values: [
        { title: draft.careersValue1Title, description: draft.careersValue1Description },
        { title: draft.careersValue2Title, description: draft.careersValue2Description },
        { title: draft.careersValue3Title, description: draft.careersValue3Description },
      ],
      ctaHeading: draft.careersCtaHeading,
      ctaBody: draft.careersCtaBody,
      ctaLabel: draft.careersCtaLabel,
    },
    contact: { hours: draft.contactHours, note: draft.contactNote },
    social: {
      facebook: draft.socialFacebook,
      instagram: draft.socialInstagram,
      twitter: draft.socialTwitter,
      linkedin: draft.socialLinkedin,
      tiktok: draft.socialTiktok,
      whatsapp: draft.socialWhatsapp,
    },
    footer: { tagline: draft.footerTagline },
  };
}

export function SiteContentManagement({
  state,
  fallback,
}: {
  state: TenantSiteContentState;
  fallback: TenantSiteContent;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const initial = useMemo(() => buildInitialDraft(state), [state]);
  const [draft, setDraft] = useState<DraftState>(initial);

  const update = (key: StringDraftKey) => (value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  async function saveDraft() {
    setPending(true);
    const response = await fetch("/api/admin/settings/site-content", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(draft)),
    });
    setPending(false);

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as {
        error?: string;
        issues?: Array<{ path?: string; message?: string }>;
      } | null;
      const firstIssue = json?.issues?.[0];
      toast.error(
        firstIssue?.message
          ? `${firstIssue.path ? `${firstIssue.path}: ` : ""}${firstIssue.message}`
          : json?.error ?? "Unable to save site content draft.",
      );
      return;
    }

    toast.success("Site content draft saved.");
    router.refresh();
  }

  async function runAction(action: "publish" | "reset") {
    setPending(true);
    const response = await fetch("/api/admin/settings/site-content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setPending(false);

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(json?.error ?? `Unable to ${action} site content.`);
      return;
    }

    toast.success(action === "publish" ? "Site content published." : "Draft reset to published content.");
    if (action === "reset") {
      setDraft(buildInitialDraft({ ...state, draft: state.published }));
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-[28px] border-[var(--border-subtle,var(--line))] bg-[linear-gradient(135deg,#ffffff,#fbf7ef)] p-6 shadow-[var(--shadow-sm)] lg:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-700)]">
              Site content
            </div>
            <h2 className="mt-3 font-serif text-2xl text-[var(--ink-950)] sm:text-3xl">
              Make the public site sound like your company.
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-600)]">
              Every section of your public website is editable here. Changes stay in draft until
              you publish. Any field left blank uses a smart default derived from your company —
              shown as the placeholder.
            </p>
            <div className="mt-4 text-xs font-medium text-[var(--ink-500)]">
              Last published: {state.publishedAt ? formatStableDate(state.publishedAt) : "Never"}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button className="whitespace-nowrap" onClick={saveDraft} disabled={pending}>
              Save draft
            </Button>
            <Button
              className="whitespace-nowrap"
              variant="outline"
              onClick={() => runAction("reset")}
              disabled={pending}
            >
              Reset draft
            </Button>
            <Button
              className="whitespace-nowrap"
              variant="secondary"
              onClick={() => runAction("publish")}
              disabled={pending}
            >
              Publish
            </Button>
          </div>
        </div>
      </Card>

      <Section
        eyebrow="Search & SEO"
        title="How your site appears on Google and social shares"
        description="The browser tab title and the description search engines show under your link."
      >
        <div className="grid gap-4">
          <Field label="Site title (max 70 characters)">
            <TextInput value={draft.seoTitle} onChange={update("seoTitle")} placeholder={fallback.seo.title} />
          </Field>
          <Field label="Meta description (max 170 characters)">
            <TextArea value={draft.seoDescription} onChange={update("seoDescription")} placeholder={fallback.seo.description} rows={2} />
          </Field>
        </div>
      </Section>

      <Section
        eyebrow="Hero"
        title="The first thing visitors read"
        description="Your homepage headline, supporting line, and primary actions."
      >
        <div className="grid gap-4">
          <Field label="Eyebrow">
            <TextInput value={draft.heroEyebrow} onChange={update("heroEyebrow")} placeholder={fallback.hero.eyebrow} />
          </Field>
          <Field label="Headline">
            <TextArea value={draft.heroHeadline} onChange={update("heroHeadline")} placeholder={fallback.hero.headline} />
          </Field>
          <Field label="Subheading">
            <TextArea value={draft.heroSubhead} onChange={update("heroSubhead")} placeholder={fallback.hero.subhead} rows={3} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Primary button label">
              <TextInput value={draft.heroPrimaryLabel} onChange={update("heroPrimaryLabel")} placeholder={fallback.hero.primaryCta.label} />
            </Field>
            <Field label="Primary button link">
              <TextInput value={draft.heroPrimaryHref} onChange={update("heroPrimaryHref")} placeholder={fallback.hero.primaryCta.href} />
            </Field>
            <Field label="Secondary button label">
              <TextInput value={draft.heroSecondaryLabel} onChange={update("heroSecondaryLabel")} placeholder={fallback.hero.secondaryCta.label} />
            </Field>
            <Field label="Secondary button link">
              <TextInput value={draft.heroSecondaryHref} onChange={update("heroSecondaryHref")} placeholder={fallback.hero.secondaryCta.href} />
            </Field>
          </div>
          <p className="text-xs text-[var(--ink-500)]">
            Links must be an internal path (starting with /) or a full https / mailto / tel URL.
          </p>
        </div>
      </Section>

      <Section
        eyebrow="Hero stat cards"
        title="The three number cards under your headline"
        description="Numbers are live (listings, marketers, testimonials) — you edit the labels and supporting lines."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Card 1 label (listings count)">
            <TextInput value={draft.statInventoryLabel} onChange={update("statInventoryLabel")} placeholder={fallback.heroStats.inventoryLabel} />
          </Field>
          <Field label="Card 1 supporting line">
            <TextArea value={draft.statInventoryNote} onChange={update("statInventoryNote")} placeholder={fallback.heroStats.inventoryNote} rows={2} />
          </Field>
          <Field label="Card 2 label (marketers count)">
            <TextInput value={draft.statMarketersLabel} onChange={update("statMarketersLabel")} placeholder={fallback.heroStats.marketersLabel} />
          </Field>
          <Field label="Card 2 supporting line">
            <TextArea value={draft.statMarketersNote} onChange={update("statMarketersNote")} placeholder={fallback.heroStats.marketersNote} rows={2} />
          </Field>
          <Field label="Card 3 label (testimonials count)">
            <TextInput value={draft.statTrustLabel} onChange={update("statTrustLabel")} placeholder={fallback.heroStats.trustLabel} />
          </Field>
          <Field label="Card 3 supporting line">
            <TextArea value={draft.statTrustNote} onChange={update("statTrustNote")} placeholder={fallback.heroStats.trustNote} rows={2} />
          </Field>
        </div>
      </Section>

      <Section
        eyebrow="Hero image panel"
        title="The panel over your hero image"
        description="A short trust message layered on the hero photo (set the photo itself under Branding)."
      >
        <div className="grid gap-4">
          <Field label="Badge">
            <TextInput value={draft.panelBadge} onChange={update("panelBadge")} placeholder={fallback.heroPanel.badge} />
          </Field>
          <Field label="Title">
            <TextArea value={draft.panelTitle} onChange={update("panelTitle")} placeholder={fallback.heroPanel.title} />
          </Field>
          <Field label="Body">
            <TextArea value={draft.panelBody} onChange={update("panelBody")} placeholder={fallback.heroPanel.body} rows={2} />
          </Field>
        </div>
      </Section>

      <Section
        eyebrow="How it works"
        title="Your three-step buyer journey"
        description="Explain, in your own words, how buying with your company works."
      >
        <div className="grid gap-4">
          <Field label="Heading">
            <TextInput value={draft.journeyHeading} onChange={update("journeyHeading")} placeholder={fallback.journey.heading} />
          </Field>
          {[
            ["journeyStep1Title", "journeyStep1Description", 0],
            ["journeyStep2Title", "journeyStep2Description", 1],
            ["journeyStep3Title", "journeyStep3Description", 2],
          ].map(([titleKey, descriptionKey, index]) => (
            <div key={String(titleKey)} className="grid gap-4 md:grid-cols-[1fr_1.6fr]">
              <Field label={`Step ${Number(index) + 1} title`}>
                <TextInput
                  value={String(draft[titleKey as StringDraftKey])}
                  onChange={update(titleKey as StringDraftKey)}
                  placeholder={fallback.journey.steps[index as 0 | 1 | 2].title}
                />
              </Field>
              <Field label={`Step ${Number(index) + 1} description`}>
                <TextArea
                  value={String(draft[descriptionKey as StringDraftKey])}
                  onChange={update(descriptionKey as StringDraftKey)}
                  placeholder={fallback.journey.steps[index as 0 | 1 | 2].description}
                  rows={2}
                />
              </Field>
            </div>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Homepage sections"
        title="Section headings"
        description="The headings above Featured Properties, your marketer team, and testimonials."
      >
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Featured — eyebrow">
              <TextInput value={draft.featuredEyebrow} onChange={update("featuredEyebrow")} placeholder={fallback.sections.featured.eyebrow} />
            </Field>
            <Field label="Featured — title">
              <TextInput value={draft.featuredTitle} onChange={update("featuredTitle")} placeholder={fallback.sections.featured.title} />
            </Field>
            <Field label="Featured — description">
              <TextInput value={draft.featuredDescription} onChange={update("featuredDescription")} placeholder={fallback.sections.featured.description} />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Marketers — title">
              <TextInput value={draft.marketersTitle} onChange={update("marketersTitle")} placeholder={fallback.sections.marketers.title} />
            </Field>
            <Field label="Marketers — description">
              <TextInput value={draft.marketersDescription} onChange={update("marketersDescription")} placeholder={fallback.sections.marketers.description} />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Testimonials — eyebrow">
              <TextInput value={draft.testimonialsEyebrow} onChange={update("testimonialsEyebrow")} placeholder={fallback.sections.testimonials.eyebrow} />
            </Field>
            <Field label="Testimonials — title">
              <TextInput value={draft.testimonialsTitle} onChange={update("testimonialsTitle")} placeholder={fallback.sections.testimonials.title} />
            </Field>
            <Field label="Testimonials — description">
              <TextInput value={draft.testimonialsDescription} onChange={update("testimonialsDescription")} placeholder={fallback.sections.testimonials.description} />
            </Field>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="About"
        title="Your About page intro"
        description="The heading and opening paragraph on your About page."
      >
        <div className="grid gap-4">
          <Field label="Eyebrow">
            <TextInput value={draft.aboutEyebrow} onChange={update("aboutEyebrow")} placeholder={fallback.about.eyebrow} />
          </Field>
          <Field label="Title">
            <TextArea value={draft.aboutTitle} onChange={update("aboutTitle")} placeholder={fallback.about.title} />
          </Field>
          <Field label="Intro">
            <TextArea value={draft.aboutIntro} onChange={update("aboutIntro")} placeholder={fallback.about.intro} rows={3} />
          </Field>
        </div>
      </Section>

      <Section
        eyebrow="Careers"
        title="Your Careers page"
        description="Present your company to marketers, agents, and partners — or hide the page entirely if you're not hiring."
      >
        <div className="grid gap-4">
          <label className="flex w-fit cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle,var(--line))] bg-[var(--sand-50)] px-4 py-3">
            <input
              type="checkbox"
              checked={draft.careersVisible}
              onChange={(event) =>
                setDraft((current) => ({ ...current, careersVisible: event.target.checked }))
              }
              className="admin-focus h-4 w-4 accent-[var(--brand-700)]"
            />
            <span className="text-sm font-medium text-[var(--ink-700)]">
              Show the Careers page (uncheck to hide it and its footer link)
            </span>
          </label>
          <Field label="Eyebrow">
            <TextInput value={draft.careersEyebrow} onChange={update("careersEyebrow")} placeholder={fallback.careers.eyebrow} />
          </Field>
          <Field label="Title">
            <TextArea value={draft.careersTitle} onChange={update("careersTitle")} placeholder={fallback.careers.title} />
          </Field>
          <Field label="Intro">
            <TextArea value={draft.careersIntro} onChange={update("careersIntro")} placeholder={fallback.careers.intro} rows={2} />
          </Field>
          {[
            ["careersValue1Title", "careersValue1Description", 0],
            ["careersValue2Title", "careersValue2Description", 1],
            ["careersValue3Title", "careersValue3Description", 2],
          ].map(([titleKey, descriptionKey, index]) => (
            <div key={String(titleKey)} className="grid gap-4 md:grid-cols-[1fr_1.6fr]">
              <Field label={`Value ${Number(index) + 1} title`}>
                <TextInput
                  value={String(draft[titleKey as StringDraftKey])}
                  onChange={update(titleKey as StringDraftKey)}
                  placeholder={fallback.careers.values[index as 0 | 1 | 2].title}
                />
              </Field>
              <Field label={`Value ${Number(index) + 1} description`}>
                <TextArea
                  value={String(draft[descriptionKey as StringDraftKey])}
                  onChange={update(descriptionKey as StringDraftKey)}
                  placeholder={fallback.careers.values[index as 0 | 1 | 2].description}
                  rows={2}
                />
              </Field>
            </div>
          ))}
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Call-to-action heading">
              <TextInput value={draft.careersCtaHeading} onChange={update("careersCtaHeading")} placeholder={fallback.careers.ctaHeading} />
            </Field>
            <Field label="Call-to-action body">
              <TextInput value={draft.careersCtaBody} onChange={update("careersCtaBody")} placeholder={fallback.careers.ctaBody} />
            </Field>
            <Field label="Button label">
              <TextInput value={draft.careersCtaLabel} onChange={update("careersCtaLabel")} placeholder={fallback.careers.ctaLabel} />
            </Field>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="Contact"
        title="Office hours & contact note"
        description="Shown on your Contact page next to your address, phone, and email (set those under Settings)."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Office hours">
            <TextInput value={draft.contactHours} onChange={update("contactHours")} placeholder={fallback.contact.hours} />
          </Field>
          <Field label="Contact note">
            <TextInput value={draft.contactNote} onChange={update("contactNote")} placeholder={fallback.contact.note} />
          </Field>
        </div>
      </Section>

      <Section
        eyebrow="Social links"
        title="Where buyers can follow you"
        description="Icons appear in your site footer only for the profiles you fill in. Leave blank to hide."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Facebook URL">
            <TextInput value={draft.socialFacebook} onChange={update("socialFacebook")} placeholder="https://facebook.com/yourpage" />
          </Field>
          <Field label="Instagram URL">
            <TextInput value={draft.socialInstagram} onChange={update("socialInstagram")} placeholder="https://instagram.com/yourpage" />
          </Field>
          <Field label="X (Twitter) URL">
            <TextInput value={draft.socialTwitter} onChange={update("socialTwitter")} placeholder="https://x.com/yourpage" />
          </Field>
          <Field label="LinkedIn URL">
            <TextInput value={draft.socialLinkedin} onChange={update("socialLinkedin")} placeholder="https://linkedin.com/company/yourpage" />
          </Field>
          <Field label="TikTok URL">
            <TextInput value={draft.socialTiktok} onChange={update("socialTiktok")} placeholder="https://tiktok.com/@yourpage" />
          </Field>
          <Field label="WhatsApp number">
            <TextInput value={draft.socialWhatsapp} onChange={update("socialWhatsapp")} placeholder="+2348012345678" />
          </Field>
        </div>
      </Section>

      <Section
        eyebrow="Footer"
        title="Footer tagline"
        description="The short blurb beside your logo in the site footer."
      >
        <Field label="Tagline">
          <TextArea value={draft.footerTagline} onChange={update("footerTagline")} placeholder={fallback.footer.tagline} rows={2} />
        </Field>
      </Section>
    </div>
  );
}

function Section({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-[28px] border-[var(--border-subtle,var(--line))] bg-white p-6 shadow-[var(--shadow-sm)] lg:p-7">
      <div className="mb-5">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-700)]">{eyebrow}</div>
        <h3 className="mt-2 text-xl font-semibold text-[var(--ink-950)]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--ink-500)]">{description}</p>
      </div>
      {children}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-[var(--ink-700)]">{label}</span>
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      className="admin-focus admin-interactive h-11 w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--border-subtle,var(--line))] bg-white px-4 text-sm"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      className="admin-focus admin-interactive w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--border-subtle,var(--line))] bg-white px-4 py-3 text-sm leading-6"
      value={value}
      placeholder={placeholder}
      rows={rows}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
