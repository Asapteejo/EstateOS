"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatStableDate } from "@/lib/utils";
import type { TenantSiteContent } from "@/modules/cms/site-content";
import type { TenantSiteContentState } from "@/modules/cms/site-content-service";

type DraftState = {
  heroEyebrow: string;
  heroHeadline: string;
  heroSubhead: string;
  heroPrimaryLabel: string;
  heroPrimaryHref: string;
  heroSecondaryLabel: string;
  heroSecondaryHref: string;
  footerTagline: string;
  aboutEyebrow: string;
  aboutTitle: string;
  aboutIntro: string;
};

function buildInitialDraft(state: TenantSiteContentState): DraftState {
  const { hero, footer, about } = state.draft;
  return {
    heroEyebrow: hero?.eyebrow ?? "",
    heroHeadline: hero?.headline ?? "",
    heroSubhead: hero?.subhead ?? "",
    heroPrimaryLabel: hero?.primaryCta?.label ?? "",
    heroPrimaryHref: hero?.primaryCta?.href ?? "",
    heroSecondaryLabel: hero?.secondaryCta?.label ?? "",
    heroSecondaryHref: hero?.secondaryCta?.href ?? "",
    footerTagline: footer?.tagline ?? "",
    aboutEyebrow: about?.eyebrow ?? "",
    aboutTitle: about?.title ?? "",
    aboutIntro: about?.intro ?? "",
  };
}

function buildPayload(draft: DraftState) {
  return {
    hero: {
      eyebrow: draft.heroEyebrow,
      headline: draft.heroHeadline,
      subhead: draft.heroSubhead,
      primaryCta: { label: draft.heroPrimaryLabel, href: draft.heroPrimaryHref },
      secondaryCta: { label: draft.heroSecondaryLabel, href: draft.heroSecondaryHref },
    },
    footer: { tagline: draft.footerTagline },
    about: {
      eyebrow: draft.aboutEyebrow,
      title: draft.aboutTitle,
      intro: draft.aboutIntro,
    },
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

  const update = (key: keyof DraftState) => (value: string) =>
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
              Edit your public site copy with draft control.
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-600)]">
              Changes stay in draft until you publish. Any field left blank uses a smart default
              derived from your company — shown as the placeholder.
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
