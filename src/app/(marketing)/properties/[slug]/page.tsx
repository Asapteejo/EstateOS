import Link from "next/link";

import { OptimizedImage } from "@/components/media/optimized-image";
import { InquiryForm } from "@/components/marketing/inquiry-form";
import { InspectionForm } from "@/components/marketing/inspection-form";
import { MapSection } from "@/components/marketing/map-section";
import { NearbyAmenitiesSection } from "@/components/marketing/nearby-amenities-section";
import { PropertyActions } from "@/components/marketing/property-actions";
import { WhatsAppButton } from "@/components/shared/whatsapp-button";
import { PropertyCountdown } from "@/components/marketing/property-countdown";
import { Container } from "@/components/shared/container";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import {
  getPublicPropertiesContext,
  getPublicPropertyDetailBySlug,
} from "@/modules/properties/queries";
import { getVisibleTeamMembers } from "@/modules/team/queries";
import { getTenantAdminSettings } from "@/modules/settings/service";

function formatLandOptionLabel(option: {
  label?: string;
  unit?: string;
  sizeSqm?: number;
  numberOfPlots?: number;
  hectares?: number;
  acres?: number;
  price?: number;
  currency?: string;
}, propertyCurrency: string) {
  const parts = [
    option.label,
    option.sizeSqm ? `${option.sizeSqm}sqm` : null,
    option.numberOfPlots ? `${option.numberOfPlots} plot${option.numberOfPlots === 1 ? "" : "s"}` : null,
    option.hectares ? `${option.hectares} ha` : null,
    option.acres ? `${option.acres} acres` : null,
    option.unit === "CUSTOM" && option.label ? "Custom" : null,
  ].filter(Boolean);

  const label = parts.length > 0 ? parts.join(" - ") : "Custom option";
  return option.price
    ? `${label} (${formatCurrency(option.price, option.currency ?? propertyCurrency)})`
    : `${label} (Price on request)`;
}

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getPublicPropertiesContext();
  const [property, marketers, settings] = await Promise.all([
    getPublicPropertyDetailBySlug(slug, tenant),
    getVisibleTeamMembers(tenant),
    getTenantAdminSettings(tenant),
  ]);
  const isLand = property.type.toUpperCase() === "LAND";

  return (
    <div className="space-y-14 py-12">
      <Container className="space-y-8">
        <div className="flex flex-wrap items-center gap-4">
          <Badge>{property.status}</Badge>
          <Badge>{property.type}</Badge>
          <Badge>{property.city}</Badge>
          <Badge
            className={
              property.verification.tone === "success"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }
          >
            {property.verification.label}
          </Badge>
        </div>
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div>
              <h1 className="font-serif text-4xl text-[var(--ink-950)] sm:text-5xl">{property.title}</h1>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--ink-600)]">
                {property.description}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="relative h-[440px] md:col-span-2">
                <OptimizedImage
                  src={property.images[0] ?? "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80"}
                  alt={property.title}
                  fill
                  preset="hero"
                  className="rounded-[32px] object-cover"
                />
              </div>
              {property.images.slice(1).map((image) => (
                <div key={image} className="relative h-56">
                  <OptimizedImage src={image} alt={property.title} fill preset="card" className="rounded-[28px] object-cover" />
                </div>
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="p-8">
                <h2 className="text-2xl font-semibold text-[var(--ink-950)]">Location & map</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-600)]">{property.locationSummary}</p>
                <div className="mt-6">
                  <MapSection
                    title={property.formattedAddress ?? property.locationSummary}
                    coordinates={property.coordinates}
                    hasCoordinates={property.hasCoordinates}
                    boundaryCoordinates={property.boundaryCoordinates}
                  />
                </div>
              </Card>
              <NearbyAmenitiesSection
                coordinates={property.coordinates}
                hasCoordinates={property.hasCoordinates}
                landmarks={property.landmarks}
              />
            </div>
          </div>

          <div className="space-y-6">
            <Card className="p-8">
              <div
                className={`rounded-3xl px-4 py-4 text-sm ${
                  property.verification.tone === "success"
                    ? "bg-emerald-50 text-emerald-900"
                    : "bg-amber-50 text-amber-900"
                }`}
              >
                <div className="font-semibold">{property.verification.label}</div>
                <p className="mt-2 leading-6">{property.verification.detail}</p>
              </div>
              <div className="mt-6 text-sm uppercase tracking-[0.18em] text-[var(--ink-500)]">Price</div>
              <div className="mt-2 text-4xl font-semibold text-[var(--ink-950)]">
                {formatCurrency(property.priceFrom, property.currency)}
                {property.priceTo ? ` - ${formatCurrency(property.priceTo, property.currency)}` : ""}
              </div>
              {property.countdown ? (
                <div className="mt-5">
                  <PropertyCountdown label={property.countdown.label} offerEndsAt={property.countdown.offerEndsAt} />
                </div>
              ) : null}
              <div className="mt-5 grid grid-cols-2 gap-4 text-sm text-[var(--ink-700)]">
                {isLand ? (
                  <>
                    {property.landSizeSqm ? <div>{property.landSizeSqm} sqm</div> : null}
                    {property.numberOfPlots ? <div>{property.numberOfPlots} plot{property.numberOfPlots === 1 ? "" : "s"}</div> : null}
                    {property.hectares ? <div>{property.hectares} ha</div> : null}
                    {property.acres ? <div>{property.acres} acres</div> : null}
                    {property.plotOptions.length > 0 ? <div>{property.plotOptions.length} plot option(s)</div> : null}
                  </>
                ) : (
                  <>
                    <div>{property.bedrooms} bedrooms</div>
                    <div>{property.bathrooms} bathrooms</div>
                    <div>{property.parkingSpaces} parking</div>
                    <div>{property.sizeSqm} sqm</div>
                  </>
                )}
              </div>
              {isLand && property.plotOptions.length > 0 ? (
                <div className="mt-5 rounded-3xl bg-[var(--sand-100)] p-4 text-sm text-[var(--ink-700)]">
                  <div className="font-semibold text-[var(--ink-950)]">Available sizes</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {property.plotOptions.map((option, index) => (
                      <span key={`${option.label ?? "plot"}-${index}`} className="rounded-full bg-white px-3 py-2">
                        {formatLandOptionLabel(option, property.currency)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-6 space-y-3">
                <PropertyActions
                  propertyId={property.id}
                  propertyPath={`/properties/${slug}`}
                  tenantSlug={tenant.companySlug}
                  tenantHost={tenant.host}
                  marketers={marketers.map((marketer) => ({
                    id: marketer.id,
                    fullName: marketer.fullName,
                    title: marketer.title,
                  }))}
                  paymentPlans={property.paymentOptions.map((plan) => ({
                    id: plan.id,
                    title: plan.title,
                    kind: plan.kind,
                  }))}
                />
                {settings.whatsappNumber ? (
                  <WhatsAppButton
                    phone={settings.whatsappNumber}
                    label="Chat with us on WhatsApp"
                    message={`Hi, I\u2019m interested in ${property.title} (${formatCurrency(property.priceFrom, property.currency)}). Can you share more details?`}
                    className="admin-focus flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1eb959]"
                  />
                ) : null}
                {property.brochureUrl ? (
                  <Link href={property.brochureUrl} className="block">
                    <Button variant="outline" className="w-full">
                      Download brochure
                    </Button>
                  </Link>
                ) : (
                  <Button variant="outline" className="w-full" disabled>
                    Brochure unavailable
                  </Button>
                )}
              </div>
            </Card>
            <Card className="p-8">
              <h2 className="text-xl font-semibold text-[var(--ink-950)]">Payment options</h2>
              <div className="mt-5 space-y-4">
                {property.paymentOptions.length > 0 ? (
                  property.paymentOptions.map((plan) => (
                    <div key={plan.id} className="rounded-2xl bg-[var(--sand-100)] p-4 text-sm text-[var(--ink-700)]">
                      <div className="flex items-center justify-between gap-4">
                        <div className="font-semibold text-[var(--ink-950)]">{plan.title}</div>
                        <Badge>{plan.kind.toLowerCase()}</Badge>
                      </div>
                      <p className="mt-2 leading-6 text-[var(--ink-600)]">
                        {plan.scheduleDescription ?? plan.description ?? "Structured payment option available."}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-4">
                        <span>Duration: {plan.durationMonths} months</span>
                        <span>Installments: {plan.installmentCount ?? plan.installments.length}</span>
                        <span>
                          Deposit: {plan.depositPercent != null ? `${plan.depositPercent}%` : "Custom"}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-[var(--ink-600)]">{property.paymentPlan.summary}</p>
                )}
              </div>
            </Card>
            {marketers.length > 0 ? (
              <Card className="p-8">
                <h2 className="text-xl font-semibold text-[var(--ink-950)]">Choose a marketer</h2>
                <p className="mt-2 text-sm text-[var(--ink-600)]">
                  If you are already working with a marketer, select them before reserving so the deal is attached correctly from the start.
                </p>
                <div className="mt-5 space-y-3">
                  {marketers.map((marketer) => (
                    <div key={marketer.id} className="rounded-2xl bg-[var(--sand-100)] p-4">
                      <div className="font-semibold text-[var(--ink-950)]">{marketer.fullName}</div>
                      <div className="mt-1 text-sm text-[var(--brand-700)]">{marketer.title}</div>
                      <p className="mt-2 text-sm leading-6 text-[var(--ink-600)]">{marketer.bio}</p>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}
            {!isLand ? (
            <Card className="p-8">
              <h2 className="text-xl font-semibold text-[var(--ink-950)]">Available units</h2>
              <div className="mt-5 space-y-3">
                {property.units.length > 0 ? (
                  property.units.map((unit) => (
                    <div
                      key={unit.id}
                      className="rounded-2xl bg-[var(--sand-100)] px-4 py-4 text-sm text-[var(--ink-700)]"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="font-semibold text-[var(--ink-950)]">
                          {unit.title} ({unit.unitCode})
                        </div>
                        <Badge>{unit.status.toLowerCase()}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-4">
                        <span>{formatCurrency(unit.price)}</span>
                        <span>{unit.bedrooms ?? 0} bed</span>
                        <span>{unit.bathrooms ?? 0} bath</span>
                        <span>{unit.sizeSqm ?? 0} sqm</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="No unit breakdown published"
                    description="This property is currently marketed at the project level."
                  />
                )}
              </div>
            </Card>
            ) : null}
            {property.videoUrl ? (
              <Card className="p-8">
                <h2 className="text-xl font-semibold text-[var(--ink-950)]">Video walkthrough</h2>
                <p className="mt-2 text-sm text-[var(--ink-600)]">
                  Watch the walkthrough with controls. Playback does not autoplay.
                </p>
                <video
                  src={property.videoUrl}
                  controls
                  preload="metadata"
                  className="mt-5 aspect-video w-full rounded-3xl bg-black"
                />
                <Link href={property.videoUrl} target="_blank" rel="noreferrer" className="mt-4 block">
                  <Button variant="outline" className="w-full">
                    Open video walkthrough
                  </Button>
                </Link>
              </Card>
            ) : null}
            <Card className="p-8">
              <h2 className="text-xl font-semibold text-[var(--ink-950)]">Book inspection</h2>
              <p className="mt-2 text-sm text-[var(--ink-600)]">
                Schedule a viewing or consultation with our transactions team.
              </p>
              <div className="mt-5">
                <InspectionForm propertyId={property.id} />
              </div>
            </Card>
            <Card className="p-8">
              <h2 className="text-xl font-semibold text-[var(--ink-950)]">Send inquiry</h2>
              <div className="mt-5">
                <InquiryForm propertyId={property.id} />
              </div>
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
}
