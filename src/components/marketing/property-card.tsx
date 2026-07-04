import Link from "next/link";

import { OptimizedImage } from "@/components/media/optimized-image";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { PropertySummary } from "@/types/domain";

export function PropertyCard({ property }: { property: PropertySummary }) {
  const isLand = property.type.toUpperCase() === "LAND";
  const landSizes = property.plotOptions
    .map((option) => {
      const label = option.label ?? (option.sizeSqm ? `${option.sizeSqm} sqm` : option.hectares ? `${option.hectares} ha` : option.acres ? `${option.acres} acres` : null);
      if (!label) {
        return null;
      }

      return `${label} — ${option.price ? formatCurrency(option.price, option.currency ?? property.currency) : "Price on request"}`;
    })
    .filter(Boolean);

  return (
    <Card className="group overflow-hidden transition-[transform,box-shadow] duration-300 ease-[var(--ease-out)] hover:-translate-y-1 hover:shadow-[var(--shadow-md)]">
      <div className="relative h-72 overflow-hidden">
        <OptimizedImage
          src={property.images[0]}
          alt={property.title}
          fill
          preset="card"
          className="object-cover transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-105"
        />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <Badge className="bg-white/90">{property.status}</Badge>
          <Badge
            className={
              property.verification.tone === "success"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }
          >
            {property.verification.status === "VERIFIED" ? "Verified" : "Stale"}
          </Badge>
        </div>
      </div>
      <div className="space-y-4 p-6">
        <div className="space-y-2">
          <div className="text-sm text-[var(--ink-500)]">{property.locationSummary}</div>
          <h3 className="font-serif text-2xl text-[var(--ink-950)]">{property.title}</h3>
          <p className="text-sm leading-6 text-[var(--ink-600)]">{property.shortDescription}</p>
          <p className="text-xs font-medium text-[var(--ink-500)]">{property.verification.label}</p>
        </div>
        <div className="flex items-center justify-between text-sm text-[var(--ink-700)]">
          {isLand ? (
            <>
              <span>{property.landSizeSqm ? `${property.landSizeSqm} sqm` : "Land"}</span>
              <span>{property.numberOfPlots ? `${property.numberOfPlots} plot${property.numberOfPlots === 1 ? "" : "s"}` : "Plots"}</span>
              <span>{landSizes.length > 0 ? landSizes.slice(0, 2).join(", ") : "Flexible sizes"}</span>
            </>
          ) : (
            <>
              <span>{property.bedrooms} bed</span>
              <span>{property.bathrooms} bath</span>
              <span>{property.sizeSqm} sqm</span>
            </>
          )}
        </div>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--ink-500)]">
              Starting from
            </div>
            <div className="text-2xl font-semibold text-[var(--ink-950)]">
              {formatCurrency(property.priceFrom, property.currency)}
            </div>
          </div>
          <Link
            href={`/properties/${property.slug}`}
            className="text-sm font-semibold text-[var(--brand-700)]"
          >
            View property
          </Link>
        </div>
      </div>
    </Card>
  );
}
