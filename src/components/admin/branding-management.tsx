"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { OptimizedImage } from "@/components/media/optimized-image";
import { UploadField } from "@/components/uploads/upload-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { generateThemeFromLogoUrl } from "@/modules/branding/auto-theme";
import type { TenantBrandingConfig, TenantBrandingState } from "@/modules/branding/theme";
import {
  applyBrandingPreset,
  brandingPresets,
  buildTenantThemeStyles,
  getBrandingPublishIssues,
} from "@/modules/branding/theme";

function buildPreviewName(companyName?: string) {
  return companyName?.trim() || "Acme Realty";
}

export function BrandingManagement({
  state,
  companyName,
}: {
  state: TenantBrandingState;
  companyName?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [draft, setDraft] = useState<TenantBrandingConfig>(state.draft);
  const [generatedTheme, setGeneratedTheme] = useState<TenantBrandingConfig | null>(null);
  const issues = useMemo(() => getBrandingPublishIssues(draft), [draft]);
  const publicTheme = useMemo(() => buildTenantThemeStyles(draft, "public"), [draft]);
  const appTheme = useMemo(() => buildTenantThemeStyles(draft, "app"), [draft]);
  const previewName = buildPreviewName(companyName);
  const previewFrameClass = previewMode === "mobile" ? "mx-auto max-w-[390px]" : "";

  async function saveDraft() {
    setPending(true);
    const response = await fetch("/api/admin/settings/branding", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(draft),
    });
    setPending(false);

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(json?.error ?? "Unable to save branding draft.");
      return;
    }

    toast.success("Branding draft saved.");
    router.refresh();
  }

  async function runAction(action: "publish" | "reset") {
    setPending(true);
    const response = await fetch("/api/admin/settings/branding", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action }),
    });
    setPending(false);

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(json?.error ?? `Unable to ${action} branding.`);
      return;
    }

    toast.success(action === "publish" ? "Branding published." : "Draft reset to published branding.");
    router.refresh();
  }

  async function generateFromLogo() {
    try {
      setPending(true);
      const nextTheme = await generateThemeFromLogoUrl(draft.logoUrl ?? "", draft);
      setGeneratedTheme(nextTheme);
      toast.success("Draft palette generated from the selected logo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to generate a theme from this logo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-[34px] border-[var(--line)] bg-[linear-gradient(135deg,#ffffff,#fbf7ef)]">
        <div className="border-b border-[var(--line)] px-6 py-6 lg:px-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-700)]">Branding studio</div>
              <h2 className="mt-3 font-serif text-3xl text-[var(--ink-950)] sm:text-4xl">Design the tenant brand with safe rails and draft control.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-600)]">
                Draft changes stay private until published. Public tenant pages can feel more branded, while buyer and admin surfaces stay restrained and readable.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 xl:w-[440px]">
              <StudioStat
                label="Draft state"
                value={state.isDirty ? "Needs review" : "Aligned"}
                tone={state.isDirty ? "brand" : "neutral"}
              />
              <StudioStat
                label="Publish checks"
                value={issues.length === 0 ? "Ready" : `${issues.length} issue${issues.length === 1 ? "" : "s"}`}
                tone={issues.length === 0 ? "success" : "warning"}
              />
              <StudioStat
                label="Last published"
                value={state.publishedAt ? new Date(state.publishedAt).toLocaleDateString() : "Never"}
                tone="neutral"
              />
            </div>
          </div>
        </div>
        <div className="px-6 py-5 lg:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              <StatusPill>{state.isDirty ? "Draft differs from live" : "Draft matches live"}</StatusPill>
              <StatusPill>Public branding publishes manually</StatusPill>
              <StatusPill>Admin and portal stay restrained</StatusPill>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={saveDraft} disabled={pending}>Save draft</Button>
              <Button variant="outline" onClick={() => runAction("reset")} disabled={pending}>Reset draft</Button>
              <Button variant="secondary" onClick={() => runAction("publish")} disabled={pending || issues.length > 0}>Publish branding</Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.05fr)_minmax(440px,0.95fr)]">
        <div className="space-y-6">
          <StudioSection
            eyebrow="Preset themes"
            title="Start from a strong visual direction"
            description="Choose a polished preset, then refine the draft. Presets only affect draft branding until you publish."
          >
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {brandingPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setDraft((current) => applyBrandingPreset(current, preset.id))}
                  className="rounded-3xl border border-[var(--line)] bg-[var(--sand-100)] p-4 text-left transition hover:border-[var(--brand-700)] hover:bg-white"
                >
                  <div className="flex gap-2">
                    {[preset.config.primaryColor, preset.config.secondaryColor, preset.config.accentColor].map((color) => (
                      <span key={color} className="h-6 w-6 rounded-full border border-white/60" style={{ backgroundColor: color }} />
                    ))}
                  </div>
                  <div className="mt-3 text-sm font-semibold text-[var(--ink-950)]">{preset.name}</div>
                  <div className="mt-1 text-xs leading-5 text-[var(--ink-500)]">{preset.description}</div>
                </button>
              ))}
            </div>
          </StudioSection>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <StudioSection
              eyebrow="Brand identity"
              title="Core palette"
              description="Set the brand colors that influence the public site most strongly and power restrained accents in the app surfaces."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <ColorField label="Primary color" value={draft.primaryColor} onChange={(value) => setDraft((current) => ({ ...current, primaryColor: value }))} />
                <ColorField label="Secondary color" value={draft.secondaryColor} onChange={(value) => setDraft((current) => ({ ...current, secondaryColor: value }))} />
                <ColorField label="Accent color" value={draft.accentColor} onChange={(value) => setDraft((current) => ({ ...current, accentColor: value }))} />
                <ColorField label="Background color" value={draft.backgroundColor} onChange={(value) => setDraft((current) => ({ ...current, backgroundColor: value }))} />
                <ColorField label="Surface color" value={draft.surfaceColor} onChange={(value) => setDraft((current) => ({ ...current, surfaceColor: value }))} />
                <Field label="Text mode">
                  <select className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm" value={draft.textMode} onChange={(event) => setDraft((current) => ({ ...current, textMode: event.target.value as TenantBrandingConfig["textMode"] }))}>
                    <option value="AUTO">Auto</option>
                    <option value="LIGHT">Light</option>
                    <option value="DARK">Dark</option>
                  </select>
                </Field>
              </div>
            </StudioSection>

            <StudioSection
              eyebrow="Surface behavior"
              title="How the theme behaves"
              description="These controls govern how bold the public site feels and how restrained the app surfaces stay."
            >
              <div className="grid gap-4">
                <Field label="Background style">
                  <select className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm" value={draft.backgroundStyle} onChange={(event) => setDraft((current) => ({ ...current, backgroundStyle: event.target.value as TenantBrandingConfig["backgroundStyle"] }))}>
                    <option value="CLEAN_APP_DEFAULT">Clean app default</option>
                    <option value="LIGHT">Light</option>
                    <option value="DARK">Dark</option>
                    <option value="SOFT_GRADIENT">Soft gradient</option>
                    <option value="BRANDED_GRADIENT">Branded gradient</option>
                    <option value="IMAGE_HERO">Image hero</option>
                  </select>
                </Field>
                <Field label="Button style">
                  <select className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm" value={draft.buttonStyle} onChange={(event) => setDraft((current) => ({ ...current, buttonStyle: event.target.value as TenantBrandingConfig["buttonStyle"] }))}>
                    <option value="PILL">Pill</option>
                    <option value="ROUNDED">Rounded</option>
                    <option value="SOFT">Soft</option>
                  </select>
                </Field>
                <Field label="Card style">
                  <select className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm" value={draft.cardStyle} onChange={(event) => setDraft((current) => ({ ...current, cardStyle: event.target.value as TenantBrandingConfig["cardStyle"] }))}>
                    <option value="SOFT">Soft</option>
                    <option value="GLASS">Glass</option>
                    <option value="OUTLINED">Outlined</option>
                  </select>
                </Field>
                <Field label="Navigation style">
                  <select className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm" value={draft.navStyle} onChange={(event) => setDraft((current) => ({ ...current, navStyle: event.target.value as TenantBrandingConfig["navStyle"] }))}>
                    <option value="FLOATING">Floating</option>
                    <option value="SOLID">Solid</option>
                    <option value="MINIMAL">Minimal</option>
                  </select>
                </Field>
              </div>
            </StudioSection>
          </div>

          <StudioSection
            eyebrow="Brand assets"
            title="Logos and visual assets"
            description="Keep the tenant identity tidy. Public-brand assets are reusable, previewable, and still tenant-scoped."
          >
            <div className="grid gap-4 xl:grid-cols-3">
              <UploadField
                label="Logo"
                purpose="BRAND_LOGO"
                surface="admin"
                mode="publicAsset"
                helperText="Used across the public tenant site, buyer portal, and tenant admin shell."
                allowExternalUrl
                value={{ url: draft.logoUrl }}
                onChange={(value) => {
                  setDraft((current) => ({ ...current, logoUrl: value.url ?? null }));
                  setGeneratedTheme(null);
                }}
              />
              <UploadField
                label="Favicon"
                purpose="BRAND_FAVICON"
                surface="admin"
                mode="publicAsset"
                helperText="Used for public tenant tabs and metadata icons."
                allowExternalUrl
                value={{ url: draft.faviconUrl }}
                onChange={(value) => setDraft((current) => ({ ...current, faviconUrl: value.url ?? null }))}
              />
              <UploadField
                label="Hero image"
                purpose="BRAND_HERO"
                surface="admin"
                mode="publicAsset"
                helperText="Only affects more expressive public hero treatments."
                allowExternalUrl
                value={{ url: draft.heroImageUrl }}
                onChange={(value) => setDraft((current) => ({ ...current, heroImageUrl: value.url ?? null }))}
              />
            </div>
          </StudioSection>

          <StudioSection
            eyebrow="Auto theme"
            title="Generate a draft palette from the logo"
            description="Use this when a team wants a faster starting point. The generated theme still stays in draft until you review and publish it."
          >
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="max-w-2xl text-sm leading-6 text-[var(--ink-500)]">
                EstateOS samples the selected logo and proposes a safer draft palette. It does not publish automatically and it does not bypass contrast safeguards.
              </div>
              <Button type="button" variant="outline" onClick={generateFromLogo} disabled={pending || !draft.logoUrl}>
                Generate from logo
              </Button>
            </div>

            {generatedTheme ? (
              <div className="mt-5 rounded-[28px] border border-[var(--line)] bg-[var(--sand-100)] p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-700)]">Suggested draft palette</div>
                    <div className="mt-2 text-sm text-[var(--ink-600)]">Review the generated colors, then apply or discard them.</div>
                  </div>
                  <div className="flex gap-2">
                    {[generatedTheme.primaryColor, generatedTheme.secondaryColor, generatedTheme.accentColor].map((color) => (
                      <span key={color} className="h-9 w-9 rounded-full border border-white shadow-sm" style={{ backgroundColor: color }} />
                    ))}
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button
                    type="button"
                    onClick={() => {
                      setDraft(generatedTheme);
                      setGeneratedTheme(null);
                    }}
                  >
                    Apply to draft
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setGeneratedTheme(null)}>
                    Discard
                  </Button>
                </div>
              </div>
            ) : null}
          </StudioSection>
        </div>

        <div className="space-y-6 2xl:sticky 2xl:top-6 2xl:self-start">
          <Card className="overflow-hidden rounded-[32px] border-[var(--line)] bg-[linear-gradient(180deg,#ffffff,#fbfaf6)]">
            <div className="border-b border-[var(--line)] px-5 py-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[var(--brand-700)]">Studio preview rail</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="text-xl font-semibold text-[var(--ink-950)]">Preview before anything goes live</div>
                    <Badge className="bg-white text-[var(--ink-700)] ring-1 ring-black/5">
                      {previewMode === "desktop" ? "Desktop frame" : "Mobile frame"}
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-[var(--ink-500)]">
                    Representative product surfaces render from the current draft only. Published branding stays untouched until you approve it.
                  </div>
                </div>
                <div className="inline-flex rounded-full border border-[var(--line)] bg-[var(--sand-100)] p-1">
                  {(["desktop", "mobile"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPreviewMode(mode)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${previewMode === mode ? "bg-white text-[var(--ink-950)] shadow-sm" : "text-[var(--ink-600)]"}`}
                    >
                      {mode === "desktop" ? "Desktop" : "Mobile"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div className="grid gap-3 md:grid-cols-2">
                <PreviewStat label="Preview status" value="Draft only" tone="brand" />
                <PreviewStat label="Current mode" value={previewMode === "desktop" ? "Desktop canvas" : "Mobile canvas"} tone="neutral" />
              </div>

              {issues.length > 0 ? (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                  <div className="font-semibold">Publish safeguards</div>
                  <ul className="mt-2 space-y-1">
                    {issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                  <div className="font-semibold">Ready to publish</div>
                  <div className="mt-1">The current draft passes the present branding safeguards.</div>
                </div>
              )}
            </div>
          </Card>

          <PreviewPanel
            title="DRAFT PREVIEW"
            subtitle="Tenant public site"
            description="More expressive public brand treatment with a stronger hero, tighter content hierarchy, and a more believable featured listing surface."
            theme={publicTheme.style}
          >
            <div className={`${previewFrameClass} rounded-[var(--tenant-card-radius,28px)] border border-white/45 bg-[color:var(--tenant-surface-overlay,rgba(255,255,255,0.76))] p-5 shadow-[0_24px_90px_rgba(15,23,42,0.14)] backdrop-blur-xl`}>
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-3">
                    <LogoMark logoUrl={draft.logoUrl} label={previewName} />
                    <div>
                      <div className="font-serif text-[22px] font-semibold tracking-[-0.02em] text-[var(--ink-950)]">{previewName}</div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.24em] text-[var(--ink-500)]">Signature transactions</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start rounded-full bg-white/78 px-3 py-2 ring-1 ring-black/5">
                    <span className="h-2 w-2 rounded-full bg-[var(--tenant-accent)]" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-600)]">
                      {previewMode === "desktop" ? "Desktop preview" : "Mobile preview"}
                    </span>
                  </div>
                </div>

                <div className={`grid gap-4 ${previewMode === "mobile" ? "" : "lg:grid-cols-[1.15fr_0.85fr]"}`}>
                  <div className="rounded-[calc(var(--tenant-card-radius,28px)+4px)] border border-white/55 bg-white/86 px-5 py-6 shadow-[0_18px_50px_rgba(15,23,42,0.10)]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--tenant-accent)]">Draft preview</div>
                    <h3 className="mt-3 max-w-lg font-serif text-[34px] leading-[1.05] tracking-[-0.03em] text-[var(--ink-950)]">
                      A cleaner, higher-trust tenant homepage with premium brand restraint.
                    </h3>
                    <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--ink-600)]">
                      The public experience can feel more expressive while listings, typography, and calls to action still read clearly for buyers.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button className="rounded-[var(--tenant-button-radius,999px)] bg-[var(--brand-700)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(15,23,42,0.18)]">
                        Explore listings
                      </button>
                      <button className="rounded-[var(--tenant-button-radius,999px)] border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink-900)]">
                        Book consultation
                      </button>
                    </div>
                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      {[
                        ["Verified stock", "Fresh listing trust"],
                        ["Flexible payments", "Visible plan clarity"],
                        ["Guided deals", "Marketer-led handoff"],
                      ].map(([label, copy]) => (
                        <div key={label} className="rounded-2xl border border-[var(--line)] bg-[var(--sand-100)]/70 px-3 py-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-500)]">{label}</div>
                          <div className="mt-2 text-sm text-[var(--ink-700)]">{copy}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-[calc(var(--tenant-card-radius,28px)+2px)] border border-white/55 bg-white/92 p-4 shadow-[0_18px_54px_rgba(15,23,42,0.10)]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-700)]">Featured listing</div>
                          <div className="mt-2 font-serif text-[28px] tracking-[-0.03em] text-[var(--ink-950)]">Eko Atrium Residences</div>
                        </div>
                        <div className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                          Verified 2d ago
                        </div>
                      </div>
                      <div className="mt-4 h-40 rounded-[26px] border border-white/40 shadow-inner" style={{ background: `linear-gradient(135deg, ${draft.primaryColor}, ${draft.accentColor})` }} />
                      <div className="mt-4 flex items-end justify-between gap-4">
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-[var(--ink-500)]">Starting from</div>
                          <div className="mt-1 text-2xl font-semibold text-[var(--ink-950)]">₦145M</div>
                        </div>
                        <div className="text-right text-sm text-[var(--ink-600)]">
                          <div>4 bed</div>
                          <div>2,100 sqm</div>
                        </div>
                      </div>
                    </div>
                    <div className={`grid gap-3 ${previewMode === "mobile" ? "" : "sm:grid-cols-2"}`}>
                      {["Strong contrast", "Clear CTA rhythm"].map((item) => (
                        <div key={item} className="rounded-2xl border border-white/45 bg-white/72 px-4 py-4 shadow-[0_12px_34px_rgba(15,23,42,0.08)]">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)]">{item}</div>
                          <div className="mt-2 text-sm leading-6 text-[var(--ink-700)]">
                            Premium polish comes from hierarchy, clarity, and more realistic spacing instead of louder decoration.
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </PreviewPanel>

          <PreviewPanel
            title="DRAFT PREVIEW"
            subtitle="Tenant app surfaces"
            description="Restrained internal app branding with more believable dashboard and portal cards, denser content structure, and a calmer shell."
            theme={appTheme.style}
          >
            <div className={`${previewFrameClass} rounded-[var(--tenant-card-radius,28px)] border border-[var(--line)] bg-[color:var(--tenant-background)] p-4 shadow-[0_22px_80px_rgba(15,23,42,0.12)]`}>
              <div className={`grid gap-4 ${previewMode === "mobile" ? "" : "md:grid-cols-[250px_1fr]"}`}>
                <div className="rounded-[var(--tenant-card-radius,28px)] border border-[var(--tenant-nav-border)] bg-[var(--tenant-nav-surface)] p-4 shadow-[var(--tenant-nav-shadow)]">
                  <div className="flex items-center gap-3">
                    <LogoMark logoUrl={draft.logoUrl} label={previewName} />
                    <div>
                      <div className="text-sm font-semibold text-[var(--ink-950)]">{previewName}</div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[var(--ink-500)]">Admin workspace</div>
                    </div>
                  </div>
                  <div className="mt-5 space-y-2 text-sm">
                    {["Overview", "Listings", "Clients", "Payments"].map((item, index) => (
                      <div key={item} className={`rounded-2xl px-4 py-3 ${index === 0 ? "bg-[var(--sand-100)] text-[var(--ink-950)] shadow-sm" : "text-[var(--ink-700)]"}`}>
                        {item}
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 rounded-2xl border border-[var(--line)] bg-white/72 px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)]">Today</div>
                    <div className="mt-2 text-sm text-[var(--ink-700)]">3 follow-ups, 2 payments due, 1 verification alert.</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[var(--tenant-card-radius,28px)] border border-[var(--line)] bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.07)]">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-[var(--brand-700)]">Admin dashboard</div>
                        <div className="mt-2 text-2xl font-semibold text-[var(--ink-950)]">Today dashboard</div>
                        <div className="mt-1 text-sm text-[var(--ink-600)]">A cleaner action-oriented shell with brand accents used sparingly.</div>
                      </div>
                      <button className="rounded-[var(--tenant-button-radius,999px)] bg-[var(--brand-700)] px-4 py-2 text-sm font-semibold text-white">
                        Quick action
                      </button>
                    </div>
                    <div className={`mt-5 grid gap-3 ${previewMode === "mobile" ? "" : "md:grid-cols-3"}`}>
                      {[
                        ["Needs follow-up", "12"],
                        ["Payments due", "4"],
                        ["Verified today", "7"],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl border border-[var(--line)] bg-[var(--sand-100)]/70 px-4 py-4">
                          <div className="text-xs uppercase tracking-[0.16em] text-[var(--ink-500)]">{label}</div>
                          <div className="mt-2 text-2xl font-semibold text-[var(--ink-950)]">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={`grid gap-4 ${previewMode === "mobile" ? "" : "md:grid-cols-2"}`}>
                    <div className="rounded-[var(--tenant-card-radius,28px)] border border-[var(--line)] bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
                      <div className="text-xs uppercase tracking-[0.2em] text-[var(--brand-700)]">Buyer portal</div>
                      <div className="mt-2 text-lg font-semibold text-[var(--ink-950)]">Payment progress</div>
                      <div className="mt-3 h-2 rounded-full bg-[var(--sand-100)]">
                        <div className="h-2 rounded-full bg-[var(--brand-700)]" style={{ width: "68%" }} />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm text-[var(--ink-600)]">
                        <span>₦18.5M paid</span>
                        <span>Next due Apr 28</span>
                      </div>
                    </div>
                    <div className="rounded-[var(--tenant-card-radius,28px)] border border-[var(--line)] bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
                      <div className="text-xs uppercase tracking-[0.2em] text-[var(--brand-700)]">Payment request</div>
                      <div className="mt-2 text-lg font-semibold text-[var(--ink-950)]">Awaiting bank transfer</div>
                      <div className="mt-3 rounded-2xl bg-[var(--sand-100)] px-4 py-4 text-sm text-[var(--ink-700)]">
                        Temporary account details stay prominent, but the surrounding shell remains calm and readable.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </PreviewPanel>
        </div>
      </div>
    </div>
  );
}

function StudioSection({
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
    <Card className="rounded-[32px] border-[var(--line)] bg-white p-6 lg:p-7">
      <div className="mb-5">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-700)]">{eyebrow}</div>
        <h3 className="mt-3 text-2xl font-semibold text-[var(--ink-950)]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--ink-500)]">{description}</p>
      </div>
      {children}
    </Card>
  );
}

function StudioStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "brand" | "success" | "warning" | "neutral";
}) {
  const toneClass =
    tone === "brand"
      ? "bg-[var(--sand-100)] text-[var(--brand-700)]"
      : tone === "success"
        ? "bg-emerald-50 text-emerald-700"
        : tone === "warning"
          ? "bg-amber-50 text-amber-700"
          : "bg-slate-100 text-slate-700";

  return (
    <div className="rounded-3xl border border-[var(--line)] bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-500)]">{label}</div>
      <div className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--ink-600)]">
      {children}
    </span>
  );
}

function PreviewStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "brand" | "neutral";
}) {
  return (
    <div className="rounded-3xl border border-[var(--line)] bg-white px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-500)]">{label}</div>
      <div className={`mt-2 text-sm font-semibold ${tone === "brand" ? "text-[var(--brand-700)]" : "text-[var(--ink-900)]"}`}>{value}</div>
    </div>
  );
}

function PreviewPanel({
  title,
  subtitle,
  description,
  theme,
  children,
}: {
  title: string;
  subtitle: string;
  description: string;
  theme: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden rounded-[32px] border-[var(--line)] bg-white">
      <div className="border-b border-[var(--line)] bg-[linear-gradient(180deg,#fff,#fcfaf4)] px-6 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[var(--brand-700)]">{title}</div>
          <span className="rounded-full bg-[var(--sand-100)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-600)]">
            {subtitle}
          </span>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--ink-500)]">{description}</p>
      </div>
      <div className="p-4">
        <div style={theme} className="rounded-[32px] border border-[var(--line)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
          {children}
        </div>
      </div>
    </Card>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const pickerValue = /^#([0-9a-fA-F]{6})$/.test(value) ? value : "#0F5C4D";

  return (
    <Field label={label}>
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-3 py-2">
        <input type="color" className="h-8 w-10 rounded-lg border-0 bg-transparent p-0" value={pickerValue} onChange={(event) => onChange(event.target.value.toUpperCase())} />
        <input className="h-9 flex-1 bg-transparent text-sm outline-none" value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} />
      </div>
    </Field>
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

function LogoMark({
  logoUrl,
  label,
}: {
  logoUrl?: string | null;
  label: string;
}) {
  const initials = label
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-[var(--brand-700)] text-sm font-semibold text-white">
      {logoUrl ? (
        <OptimizedImage src={logoUrl} alt={label} fill preset="thumbnail" className="object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}
