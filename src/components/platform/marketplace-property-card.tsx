import Link from "next/link";

import { OptimizedImage } from "@/components/media/optimized-image";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { MarketplacePropertySummary } from "@/modules/properties/marketplace";

export function MarketplacePropertyCard({
  property,
}: {
  property: MarketplacePropertySummary;
}) {
  const detailHref = `/platform/properties/${property.companySlug}/${property.slug}`;

  return (
    <Card className="overflow-hidden">
      <div className="relative h-64">
        {property.images[0] ? (
          <OptimizedImage
            src={property.images[0]}
            alt={property.title}
            fill
            preset="card"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[var(--sand-100)] text-[var(--ink-400)]">
            No image
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Badge className="bg-white/90 text-[var(--ink-700)] text-[10px]">
            {property.status}
          </Badge>
          <Badge
            className={
              property.verification.tone === "success"
                ? "bg-emerald-100 text-emerald-800 text-[10px]"
                : "bg-amber-100 text-amber-800 text-[10px]"
            }
          >
            {property.verification.status === "VERIFIED" ? "Verified" : "Stale"}
          </Badge>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {/* Company badge */}
        <div className="flex items-center gap-2">
          {property.companyLogoUrl ? (
            <div className="relative h-5 w-5 overflow-hidden rounded-md">
              <OptimizedImage
                src={property.companyLogoUrl}
                alt={property.companyName}
                fill
                preset="thumbnail"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--ink-950)] text-[8px] font-bold text-white">
              {property.companyName.charAt(0)}
            </div>
          )}
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-500)]">
            {property.companyName}
          </span>
        </div>

        <div className="space-y-1">
          <div className="text-xs text-[var(--ink-500)]">{property.locationSummary}</div>
          <h3 className="font-serif text-lg font-semibold leading-snug text-[var(--ink-950)]">
            {property.title}
          </h3>
          <p className="line-clamp-2 text-sm leading-6 text-[var(--ink-600)]">
            {property.shortDescription}
          </p>
        </div>

        <div className="flex items-center justify-between text-xs text-[var(--ink-600)]">
          {property.bedrooms > 0 && <span>{property.bedrooms} bed</span>}
          {property.bathrooms > 0 && <span>{property.bathrooms} bath</span>}
          {property.sizeSqm > 0 && <span>{property.sizeSqm} sqm</span>}
          <span className="rounded-full border border-[var(--line)] bg-[var(--sand-50)] px-2 py-0.5 capitalize">
            {property.type}
          </span>
        </div>

        <div className="flex items-end justify-between border-t border-[var(--line)] pt-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-500)]">
              From
            </div>
            <div className="text-xl font-semibold text-[var(--ink-950)]">
              {formatCurrency(property.priceFrom)}
            </div>
          </div>
          <Link
            href={detailHref}
            className="rounded-full bg-[var(--ink-950)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--ink-800)]"
          >
            View listing
          </Link>
        </div>
      </div>
    </Card>
  );
}
