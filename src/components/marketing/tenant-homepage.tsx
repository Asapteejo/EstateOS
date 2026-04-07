import Link from "next/link";

import { TopMarketersSection } from "@/components/marketing/top-marketers-section";
import { PropertyCard } from "@/components/marketing/property-card";
import { OptimizedImage } from "@/components/media/optimized-image";
import { Container } from "@/components/shared/container";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeading } from "@/components/shared/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { buildAuthRedirect, buildServerDomainConfig } from "@/lib/domains";
import { env } from "@/lib/env";
import type { TenantContext } from "@/lib/tenancy/context";
import { getTenantPresentation } from "@/modules/branding/service";
import { getPublicTestimonials } from "@/modules/cms/queries";
import {
  getPublicProperties,
  parsePropertySearchParams,
} from "@/modules/properties/queries";
import { getTenantMarketerLeaderboard } from "@/modules/team/performance";

export async function TenantHomepage({ tenant }: { tenant: TenantContext }) {
  const presentation = await getTenantPresentation(tenant);
  const runtimeConfig = buildServerDomainConfig(env);
  const [featuredInventory, latestInventory, testimonials, leaderboard] = await Promise.all([
    getPublicProperties(tenant, parsePropertySearchParams({ featured: "true", page: "1" })),
    getPublicProperties(tenant, parsePropertySearchParams({ page: "1" })),
    getPublicTestimonials(tenant),
    getTenantMarketerLeaderboard(tenant, new Date(), 3, "MONTHLY"),
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

  return (
    <div className="pb-16">
      <Container className="py-10 sm:py-14">
        <section className="overflow-hidden rounded-[36px] border border-[var(--line)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--brand-700)_14%,white),color-mix(in_srgb,var(--tenant-surface)_74%,white))] shadow-[0_32px_90px_rgba(15,23,42,0.08)]">
          <div className="grid gap-10 px-6 py-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-10 lg:py-10">
            <div className="flex flex-col justify-between gap-8">
              <div className="space-y-6">
                <Badge>Tenant Homepage</Badge>
                <div className="space-y-4">
                  <h1 className="max-w-4xl font-serif text-4xl leading-tight text-[var(--ink-950)] sm:text-5xl lg:text-6xl">
                    {presentation.companyName} brings discovery, trust, and transaction visibility into one property journey.
                  </h1>
                  <p className="max-w-2xl text-base leading-8 text-[var(--ink-600)] sm:text-lg">
                    Browse verified listings, work with trusted marketers, and move from first interest to reservation and payment through a branded, tenant-scoped experience.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href="/properties">
                    <Button>View Properties</Button>
                  </Link>
                  <Link href={startPurchaseHref}>
                    <Button variant="outline">Start Purchase</Button>
                  </Link>
                  <Link href="/team">
                    <Button variant="ghost">View Marketers</Button>
                  </Link>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="rounded-[26px] border-[var(--line)] bg-white/85 p-5 backdrop-blur">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)]">
                    Live inventory
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-[var(--ink-950)]">
                    {latestInventory.total}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink-600)]">
                    Public listings remain verification-aware so buyers do not browse hidden or stale inventory as active.
                  </p>
                </Card>
                <Card className="rounded-[26px] border-[var(--line)] bg-white/85 p-5 backdrop-blur">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)]">
                    Top marketers
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-[var(--ink-950)]">
                    {leaderboard.length}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink-600)]">
                    Ranked from real tenant activity using explicit buyer-selected attribution first.
                  </p>
                </Card>
                <Card className="rounded-[26px] border-[var(--line)] bg-white/85 p-5 backdrop-blur">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)]">
                    Client trust
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-[var(--ink-950)]">
                    {testimonials.length}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink-600)]">
                    Testimonials and branded communication reinforce that this tenant experience is current and operational.
                  </p>
                </Card>
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
                  <Badge className="w-fit bg-white/14 text-white">Branded tenant experience</Badge>
                  <div className="space-y-2">
                    <h2 className="max-w-md font-serif text-3xl leading-tight">
                      Verified listings with a clearer route into reservation, payment, and support.
                    </h2>
                    <p className="max-w-md text-sm leading-7 text-white/86">
                      Tenant branding, public trust indicators, and marketer visibility stay aligned from homepage browsing through central portal entry.
                    </p>
                  </div>
                </div>
              </div>
              <Card className="rounded-[28px] border-[var(--line)] bg-white p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)]">
                      Buyer journey
                    </div>
                    <h3 className="text-xl font-semibold text-[var(--ink-950)]">
                      Public browsing stays here. Authenticated actions move through the central portal cleanly.
                    </h3>
                  </div>
                  <Badge>Current phase</Badge>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {[
                    ["1", "Explore listings", "Browse featured inventory, team pages, testimonials, and branded property detail pages on this tenant domain."],
                    ["2", "Start purchase", "When a buyer needs auth, the flow continues through the central EstateOS portal without losing tenant context."],
                    ["3", "Complete with trust", "Reservations, payments, marketer attribution, and receipts remain tied back to the same tenant company."],
                  ].map(([step, title, description]) => (
                    <div key={step} className="rounded-[22px] border border-[var(--line)] bg-[var(--tenant-surface)] p-4">
                      <div className="text-sm font-semibold text-[var(--brand-700)]">0{step}</div>
                      <div className="mt-2 text-base font-semibold text-[var(--ink-950)]">{title}</div>
                      <p className="mt-2 text-sm leading-6 text-[var(--ink-600)]">{description}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </section>
      </Container>

      <Container className="space-y-14">
        <section className="space-y-8">
          <SectionHeading
            eyebrow="Featured Properties"
            title="Listings worth opening first."
            description="Featured inventory is pulled from the current tenant dataset. If no listing is explicitly featured, the newest public inventory is surfaced instead."
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

        <TopMarketersSection
          leaderboard={leaderboard}
          compact
          period="MONTHLY"
          periodHrefBuilder={(period) => `/team?topMarketers=${period}`}
          title="Top marketers already moving deals forward"
          description="Public ranking stays tenant-scoped and grounded in persisted reservations, successful payments, inspections, and qualified inquiry progress."
        />

        <section className="space-y-8">
          <SectionHeading
            eyebrow="Testimonials"
            title="Clients remember the process as much as the property."
            description="This homepage pulls public testimonial content from the tenant CMS so the trust layer stays branded and company-specific."
          />
          {testimonials.length > 0 ? (
            <div className="grid gap-6 lg:grid-cols-3">
              {testimonials.slice(0, 3).map((testimonial) => (
                <Card key={`${testimonial.fullName}-${testimonial.quote.slice(0, 24)}`} className="rounded-[28px] p-7">
                  <p className="text-base leading-8 text-[var(--ink-700)]">
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>
                  <div className="mt-6 text-sm font-semibold text-[var(--ink-950)]">{testimonial.fullName}</div>
                  <div className="text-sm text-[var(--ink-500)]">
                    {testimonial.role}
                    {testimonial.company ? `, ${testimonial.company}` : ""}
                  </div>
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
      </Container>
    </div>
  );
}
