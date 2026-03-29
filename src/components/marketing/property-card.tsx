import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { PropertySummary } from "@/types/domain";

export function PropertyCard({ property }: { property: PropertySummary }) {
  return (
    <Card className="overflow-hidden">
      <div className="relative h-72">
        <Image src={property.images[0]} alt={property.title} fill className="object-cover" />
        <div className="absolute left-4 top-4">
          <Badge className="bg-white/90">{property.status}</Badge>
        </div>
      </div>
      <div className="space-y-4 p-6">
        <div className="space-y-2">
          <div className="text-sm text-[var(--ink-500)]">{property.locationSummary}</div>
          <h3 className="font-serif text-2xl text-[var(--ink-950)]">{property.title}</h3>
          <p className="text-sm leading-6 text-[var(--ink-600)]">{property.shortDescription}</p>
        </div>
        <div className="flex items-center justify-between text-sm text-[var(--ink-700)]">
          <span>{property.bedrooms} bed</span>
          <span>{property.bathrooms} bath</span>
          <span>{property.sizeSqm} sqm</span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--ink-500)]">
              Starting from
            </div>
            <div className="text-2xl font-semibold text-[var(--ink-950)]">
              {formatCurrency(property.priceFrom)}
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
