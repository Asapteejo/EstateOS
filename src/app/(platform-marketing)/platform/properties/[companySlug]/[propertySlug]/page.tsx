import { notFound } from "next/navigation";
import Link from "next/link";

import { OptimizedImage } from "@/components/media/optimized-image";
import { Container } from "@/components/shared/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { getMarketplacePropertyDetail } from "@/modules/properties/marketplace";

export default async function MarketplacePropertyDetailPage({
  params,
}: {
  params: Promise<{ companySlug: string; propertySlug: string }>;
}) {
  const { companySlug, propertySlug } = await params;
  const property = await getMarketplacePropertyDetail(companySlug, propertySlug);

  if (!property) {
    notFound();
  }

  const primaryImage = property.images[0];
  const galleryImages = property.images.slice(1, 5);

  return (
    <Container className="space-y-10 py-12">
      {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
      <nav className="flex items-center gap-2 text-sm text-[var(--ink-500)]">
        <Link href="/platform/properties" className="hover:text-[var(--ink-950)]">
          Marketplace
        </Link>
        <span>/</span>
        <span className="text-[var(--ink-700)]">{property.companyName}</span>
        <span>/</span>
        <span className="text-[var(--ink-950)]">{property.title}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        {/* ── Left column ──────────────────────────────────────────────── */}
        <div className="space-y-8">
          {/* Primary image */}
          <div className="relative h-[420px] overflow-hidden rounded-3xl bg-[var(--sand-100)]">
            {primaryImage ? (
              <OptimizedImage
                src={primaryImage}
                alt={property.title}
                fill
                preset="hero"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[var(--ink-400)]">
                No image available
              </div>
            )}
            <div className="absolute left-4 top-4 flex gap-2">
              <Badge className="bg-white/90 text-[var(--ink-700)]">
                {property.status}
              </Badge>
              <Badge
                className={
                  property.verification.tone === "success"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }
              >
                {property.verification.status === "VERIFIED" ? "Verified" : "Stale"}
              </Badge>
              {property.featured && (
                <Badge className="bg-[var(--ink-950)] text-white">Featured</Badge>
              )}
            </div>
          </div>

          {/* Gallery thumbnails */}
          {galleryImages.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {galleryImages.map((src, i) => (
                <div
                  key={i}
                  className="relative aspect-video overflow-hidden rounded-2xl bg-[var(--sand-100)]"
                >
                  <OptimizedImage
                    src={src}
                    alt={`${property.title} image ${i + 2}`}
                    fill
                    preset="thumbnail"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Title & description */}
          <div className="space-y-4">
            <div className="text-sm text-[var(--ink-500)]">{property.locationSummary}</div>
            <h1 className="font-serif text-4xl font-semibold leading-tight tracking-[-0.02em] text-[var(--ink-950)]">
              {property.title}
            </h1>
            <p className="text-base leading-8 text-[var(--ink-600)]">
              {property.description}
            </p>
          </div>

          {/* Specs grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Type", value: property.type },
              ...(property.bedrooms > 0 ? [{ label: "Bedrooms", value: property.bedrooms }] : []),
              ...(property.bathrooms > 0 ? [{ label: "Bathrooms", value: property.bathrooms }] : []),
              ...(property.sizeSqm > 0 ? [{ label: "Size", value: `${property.sizeSqm} sqm` }] : []),
              ...(property.parkingSpaces > 0
                ? [{ label: "Parking", value: property.parkingSpaces }]
                : []),
            ].map((spec) => (
              <div
                key={spec.label}
                className="rounded-2xl border border-[var(--line)] bg-[var(--sand-50)] px-4 py-3"
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-400)]">
                  {spec.label}
                </div>
                <div className="mt-1 font-semibold capitalize text-[var(--ink-950)]">
                  {spec.value}
                </div>
              </div>
            ))}
          </div>

          {/* Features */}
          {property.features.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-500)]">
                Features
              </h2>
              <div className="flex flex-wrap gap-2">
                {property.features.map((feature) => (
                  <span
                    key={feature}
                    className="rounded-full border border-[var(--line)] bg-[var(--sand-50)] px-3 py-1.5 text-xs text-[var(--ink-600)]"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Landmarks */}
          {property.landmarks.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-500)]">
                Nearby landmarks
              </h2>
              <div className="flex flex-wrap gap-2">
                {property.landmarks.map((landmark) => (
                  <span
                    key={landmark}
                    className="rounded-full border border-[var(--line)] bg-[var(--sand-50)] px-3 py-1.5 text-xs text-[var(--ink-600)]"
                  >
                    {landmark}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Video */}
          {property.videoUrl && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-500)]">
                Video tour
              </h2>
              <a
                href={property.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl border border-[var(--line)] px-5 py-3 text-sm font-medium text-[var(--ink-700)] hover:bg-[var(--sand-50)]"
              >
                Watch video tour
              </a>
            </div>
          )}
        </div>

        {/* ── Right sidebar ─────────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Price card */}
          <div className="rounded-3xl border border-[var(--line)] bg-white p-6 shadow-sm">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-400)]">
              Starting from
            </div>
            <div className="mt-1 font-serif text-3xl font-semibold text-[var(--ink-950)]">
              {formatCurrency(property.priceFrom)}
            </div>
            {property.priceTo && property.priceTo > property.priceFrom && (
              <div className="mt-0.5 text-sm text-[var(--ink-500)]">
                Up to {formatCurrency(property.priceTo)}
              </div>
            )}
            {property.paymentPlan.durationMonths > 0 && (
              <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--sand-50)] px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-400)]">
                  Payment plan
                </div>
                <div className="mt-1 text-sm font-semibold text-[var(--ink-950)]">
                  {property.paymentPlan.title}
                </div>
                <div className="mt-0.5 text-xs text-[var(--ink-500)]">
                  {property.paymentPlan.durationMonths} month plan
                  {property.paymentPlan.depositPercent > 0
                    ? ` · ${property.paymentPlan.depositPercent}% deposit`
                    : ""}
                </div>
              </div>
            )}
          </div>

          {/* Agency card */}
          <div className="rounded-3xl border border-[var(--line)] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              {property.companyLogoUrl ? (
                <div className="relative h-10 w-10 overflow-hidden rounded-xl">
                  <OptimizedImage
                    src={property.companyLogoUrl}
                    alt={property.companyName}
                    fill
                    preset="thumbnail"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--ink-950)] font-bold text-white">
                  {property.companyName.charAt(0)}
                </div>
              )}
              <div>
                <div className="font-semibold text-[var(--ink-950)]">{property.companyName}</div>
                <div className="text-xs text-[var(--ink-500)]">Verified EstateOS agency</div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-[var(--ink-600)]">
              This listing is managed by {property.companyName}. Contact them directly
              through their portal to book an inspection or make an inquiry.
            </p>
            <div className="mt-5 space-y-2">
              <a
                href={`/properties/${property.slug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="w-full">Visit agency listing</Button>
              </a>
              <p className="text-center text-[11px] text-[var(--ink-400)]">
                Opens on the agency&rsquo;s own site
              </p>
            </div>
          </div>

          {/* Verification note */}
          <div
            className={`rounded-2xl border px-4 py-4 text-sm leading-6 ${
              property.verification.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            <span className="font-semibold">{property.verification.label}.</span>{" "}
            {property.verification.detail}
          </div>

          <Link href="/platform/properties">
            <Button variant="outline" className="w-full">
              Back to marketplace
            </Button>
          </Link>
        </div>
      </div>
    </Container>
  );
}
