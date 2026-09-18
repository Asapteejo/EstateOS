import Link from "next/link";

import { TopMarketersSection } from "@/components/marketing/top-marketers-section";
import { PropertyCard } from "@/components/marketing/property-card";
import { OptimizedImage } from "@/components/media/optimized-image";
import { Container } from "@/components/shared/container";
import { EmptyState } from "@/components/shared/empty-state";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeading } from "@/components/shared/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Magnetic } from "@/components/ui/magnetic";
import { Select } from "@/components/ui/select";
import { buildAuthRedirect, buildServerDomainConfig } from "@/lib/domains";
import { env } from "@/lib/env";
import { buildSafeErrorLogContext, logError } from "@/lib/ops/logger";
import type { TenantContext } from "@/lib/tenancy/context";
import { getPublicTenantPresentation } from "@/modules/branding/service";
import { getPublicTestimonials } from "@/modules/cms/queries";
import { resolveTenantSiteContent } from "@/modules/cms/site-content";
import { getPublishedSiteContent } from "@/modules/cms/site-content-service";
import {
  getPublicProperties,
  parsePropertySearchParams,
} from "@/modules/properties/queries";
import { getTenantMarketerLeaderboard } from "@/modules/team/performance";

export async function TenantHomepage({ tenant }: { tenant: TenantContext }) {
  const featuredFilters = parsePropertySearchParams({ featured: "true", page: "1" });
  const latestFilters = parsePropertySearchParams({ page: "1" });
  const safelyReadPublicData = async <T,>(
    source: string,
    read: Promise<T>,
    fallback: T,
  ) => {
    try {
      return await read;
    } catch (error) {
      logError("Tenant homepage public data lookup failed; using fallback.", {
        route: "/",
        source,
        companyId: tenant.companyId,
        ...buildSafeErrorLogContext(error),
      });
      return fallback;
    }
  };

  const presentation = await getPublicTenantPresentation(tenant);
  const runtimeConfig = buildServerDomainConfig(env);
  const [featuredInventory, latestInventory, testimonials, leaderboard] = await Promise.all([
    safelyReadPublicData("featured-properties", getPublicProperties(tenant, featuredFilters), {
      items: [],
      filters: featuredFilters,
      page: featuredFilters.page,
      total: 0,
      totalPages: 0,
    }),
    safelyReadPublicData("latest-properties", getPublicProperties(tenant, latestFilters), {
      items: [],
      filters: latestFilters,
      page: latestFilters.page,
      total: 0,
      totalPages: 0,
    }),
    safelyReadPublicData("testimonials", getPublicTestimonials(tenant, {}, { limit: 6 }), []),
    safelyReadPublicData("marketer-leaderboard", getTenantMarketerLeaderboard(tenant, new Date(), 3, "MONTHLY"), []),
  ]);

  const featuredProperties =
    featuredInventory.items.length > 0
      ? featuredInventory.items.slice(0, 3)
      : latestInventory.items.slice(0, 3);
  const heroImageUrl = presentation.branding.heroImageUrl;
  const startPurchaseHref = buildAuthRedirect(runtimeConfig, {
    returnTo: "/portal",
    tenantSlug: tenant.companySlug,
    tenantHost: tenant.host,
    entry: "purchase",
  });
  // Editable marketing copy (hero/footer/about): the tenant's published content
  // overrides the company-derived fallbacks, field by field.
  const storedContent = await getPublishedSiteContent(tenant);
  const siteContent = resolveTenantSiteContent({
    companyName: presentation.companyName,
    startPurchaseHref,
    stored: storedContent,
  });

  return (
    <div className="pb-16">
      <Container className="py-10 sm:py-14">
        <section className="overflow-hidden rounded-[36px] border border-[var(--line)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--brand-700)_14%,white),color-mix(in_srgb,var(--tenant-surface)_74%,white))] shadow-[0_32px_90px_rgba(15,23,42,0.08)]">
          <div className="grid gap-10 px-6 py-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-10 lg:py-10">
            <div className="flex flex-col justify-between gap-8">
              <div className="space-y-6">
                <Badge>{siteContent.hero.eyebrow}</Badge>
                <div className="space-y-4">
                  <h1 className="max-w-4xl font-serif text-4xl leading-tight text-[var(--ink-950)] sm:text-5xl lg:text-6xl">
                    {siteContent.hero.headline}
                  </h1>
                  <p className="max-w-2xl text-base leading-8 text-[var(--ink-600)] sm:text-lg">
                    {siteContent.hero.subhead}
                  </p>
                </div>
                {/* One primary action. The secondary route (marketers) lives
                    in its own section further down, and the header already
                    carries the portal link — three CTAs here competed with the
                    search, which is the actual front door. */}
                <div className="flex flex-wrap gap-3">
                  <Magnetic>
                    <Link href={siteContent.hero.primaryCta.href}>
                      <Button size="lg">{siteContent.hero.primaryCta.label}</Button>
                    </Link>
                  </Magnetic>
                  <Link href={siteContent.hero.secondaryCta.href}>
                    <Button variant="ghost">{siteContent.hero.secondaryCta.label}</Button>
                  </Link>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-5">
              <div className="relative min-h-[320px] overflow-hidden rounded-[30px] border border-white/70 bg-[linear-gradient(160deg,color-mix(in_srgb,var(--brand-700)_18%,white),#f7f3ec)] shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
                {heroImageUrl ? (
                  <OptimizedImage
                    src={heroImageUrl}
                    alt={presentation.companyName}
                    fill
                    preset="hero"
                    className="object-cover"
                  />
                ) : null}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,17,27,0.08),rgba(7,17,27,0.58))]" />
                <div className="relative flex h-full flex-col justify-end gap-4 p-6 text-white">
                  <Badge className="w-fit bg-white/14 text-white">{siteContent.heroPanel.badge}</Badge>
                  <div className="space-y-2">
                    <h2 className="max-w-md font-serif text-3xl leading-tight">
                      {siteContent.heroPanel.title}
                    </h2>
                    <p className="max-w-md text-sm leading-7 text-white/86">
                      {siteContent.heroPanel.body}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Search spans the hero's full width instead of sharing the text
              column with the headline, which is what clipped the placeholders
              ("City, state, or estate r", "Max budget ("). */}
          <div className="border-t border-[var(--line)]/70 px-6 pb-8 pt-6 lg:px-10">
            <form
              action="/properties"
              method="GET"
              className="grid gap-3 rounded-[24px] border border-[var(--line)] bg-white/85 p-4 backdrop-blur md:grid-cols-[1.6fr_1fr_1fr_auto]"
              aria-label="Search properties"
            >
              <Input
                type="search"
                name="location"
                placeholder="City or area"
                aria-label="Location"
              />
              <Select name="propertyType" defaultValue="" aria-label="Property type" className="w-full">
                <option value="">Any type</option>
                <option value="APARTMENT">Apartment</option>
                <option value="DUPLEX">Duplex</option>
                <option value="TERRACE">Terrace</option>
                <option value="DETACHED">Detached</option>
                <option value="SEMI_DETACHED">Semi-detached</option>
                <option value="LAND">Land</option>
                <option value="COMMERCIAL">Commercial</option>
              </Select>
              <Input
                type="number"
                name="maxPrice"
                min="1"
                placeholder="Max budget"
                aria-label="Maximum budget"
              />
              <Button type="submit" className="whitespace-nowrap">Search</Button>
            </form>
          </div>
        </section>

        {/* Trust strip — only real numbers. A brand-new tenant otherwise
            advertised "EXPERT MARKETERS 0 / HAPPY CLIENTS 0" in large type
            above the fold, which is worse than showing nothing. A card with a
            zero count is dropped, and the strip disappears entirely if fewer
            than two survive. Labels and notes stay CMS-editable. */}
        {(() => {
          const stats = [
            {
              label: siteContent.heroStats.inventoryLabel,
              value: latestInventory.total,
              note: siteContent.heroStats.inventoryNote,
            },
            {
              label: siteContent.heroStats.marketersLabel,
              value: leaderboard.length,
              note: siteContent.heroStats.marketersNote,
            },
            {
              label: siteContent.heroStats.trustLabel,
              value: testimonials.length,
              note: siteContent.heroStats.trustNote,
            },
          ].filter((stat) => stat.value > 0);

          if (stats.length < 2) {
            return null;
          }

          return (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stats.map((stat) => (
                <Card key={String(stat.label)} className="rounded-[26px] border-[var(--line)] bg-white/85 p-5 backdrop-blur">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)]">
                    {stat.label}
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-[var(--ink-950)]">{stat.value}</div>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink-600)]">{stat.note}</p>
                </Card>
              ))}
            </div>
          );
        })()}
      </Container>

      <Container className="space-y-14">
        <Reveal>
          <section className="space-y-8">
          <SectionHeading
            eyebrow={siteContent.sections.featured.eyebrow}
            title={siteContent.sections.featured.title}
            description={siteContent.sections.featured.description}
          />
          {featuredProperties.length > 0 ? (
            <div className="grid gap-6 lg:grid-cols-3">
              {featuredProperties.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No public listings yet"
              description="This tenant has not published public inventory yet. Check back soon or contact the team directly."
            />
          )}
          <div className="flex flex-wrap gap-3">
            <Link href="/properties">
              <Button>Browse all properties</Button>
            </Link>
            <Link href="/team">
              <Button variant="outline">Meet the marketers</Button>
            </Link>
          </div>
          </section>
        </Reveal>

        {/* How it works — moved out of the hero's 0.8fr sidebar, where three
            cards shared ~121px each and the copy broke to one word per line.
            A primary trust explainer earns the full measure. */}
        <Reveal>
          <section className="space-y-8">
            {/* No eyebrow badge here: the CMS heading is itself the section
                name ("How it works" by default), so a badge above it just
                repeats the words. Typography matches SectionHeading's title. */}
            <h2 className="max-w-2xl font-serif text-3xl text-[var(--ink-950)] sm:text-4xl">
              {siteContent.journey.heading}
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {siteContent.journey.steps.map((step, index) => (
                <Card
                  key={step.title}
                  className="flex h-full flex-col rounded-[28px] border-[var(--line)] bg-[var(--tenant-surface)] p-6"
                >
                  <div className="text-sm font-semibold text-[var(--brand-700)]">0{index + 1}</div>
                  <div className="mt-3 font-serif text-xl text-[var(--ink-950)]">{step.title}</div>
                  <p className="mt-3 text-sm leading-7 text-[var(--ink-600)]">{step.description}</p>
                </Card>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal>
          <TopMarketersSection
            leaderboard={leaderboard}
            compact
            period="MONTHLY"
            periodHrefBuilder={(period) => `/team?topMarketers=${period}`}
            title={siteContent.sections.marketers.title}
            description={siteContent.sections.marketers.description}
          />
        </Reveal>

        <Reveal>
          <section className="space-y-8">
          <SectionHeading
            eyebrow={siteContent.sections.testimonials.eyebrow}
            title={siteContent.sections.testimonials.title}
            description={siteContent.sections.testimonials.description}
          />
          {testimonials.length > 0 ? (
            <div className="grid gap-6 lg:grid-cols-3">
              {testimonials.map((testimonial) => (
                <Card key={testimonial.id ?? `${testimonial.fullName}-${testimonial.quote.slice(0, 24)}`} className="rounded-[28px] p-7">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[var(--sand-100)] text-sm font-semibold text-[var(--ink-700)]">
                      {testimonial.avatarUrl ? (
                        <OptimizedImage src={testimonial.avatarUrl} alt={`${testimonial.fullName} avatar`} width={44} height={44} preset="thumbnail" className="h-full w-full object-cover" />
                      ) : (
                        testimonial.fullName.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[var(--ink-950)]">{testimonial.fullName}</div>
                      <div className="text-xs text-[var(--ink-500)]">
                        {testimonial.propertyTitle ?? testimonial.role}
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 text-sm font-semibold text-amber-500" aria-label={`${testimonial.rating ?? 5} star rating`}>
                    {"★".repeat(testimonial.rating ?? 5)}{"☆".repeat(5 - (testimonial.rating ?? 5))}
                  </div>
                  {testimonial.title ? (
                    <div className="mt-3 text-base font-semibold text-[var(--ink-950)]">{testimonial.title}</div>
                  ) : null}
                  <p className="text-base leading-8 text-[var(--ink-700)]">
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>
                  {testimonial.isVerifiedBuyer ? (
                    <div className="mt-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Verified buyer
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Testimonials will appear here"
              description="Tenant CMS testimonials are published to the homepage once the company adds them."
            />
          )}
          </section>
        </Reveal>
      </Container>
    </div>
  );
}
