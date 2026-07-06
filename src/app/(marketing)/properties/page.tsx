import { SlidersHorizontal } from "lucide-react";

import { PropertyCard } from "@/components/marketing/property-card";
import { TopMarketersSection } from "@/components/marketing/top-marketers-section";
import { PropertyLocationSearch } from "@/components/marketing/property-location-search";
import { Container } from "@/components/shared/container";
import { EmptyState } from "@/components/shared/empty-state";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeading } from "@/components/shared/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getPublicProperties,
  getPublicPropertiesContext,
  parsePropertySearchParams,
} from "@/modules/properties/queries";
import { getTenantMarketerLeaderboard } from "@/modules/team/performance";
import Link from "next/link";
import { Select } from "@/components/ui/select";

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tenant = await getPublicPropertiesContext();
  const params = await searchParams;
  const filters = parsePropertySearchParams(params);
  const leaderboardPeriod =
    typeof params.topMarketers === "string" && params.topMarketers === "WEEKLY"
      ? "WEEKLY"
      : "MONTHLY";
  const [properties, leaderboard] = await Promise.all([
    getPublicProperties(tenant, filters),
    getTenantMarketerLeaderboard(tenant, new Date(), 3, leaderboardPeriod),
  ]);

  const activeFilters = [
    filters.location ? `Location: ${filters.location}` : null,
    filters.propertyType ? `Type: ${filters.propertyType.replaceAll("_", " ")}` : null,
    filters.minPrice ? `Min: ${filters.minPrice}` : null,
    filters.maxPrice ? `Max: ${filters.maxPrice}` : null,
    filters.bedrooms ? `Bedrooms: ${filters.bedrooms}+` : null,
    filters.status ? `Status: ${filters.status}` : null,
    filters.hasPaymentPlan ? "Payment plan" : null,
    filters.featured ? "Featured" : null,
    filters.radiusKm && filters.latitude != null && filters.longitude != null
      ? `Within ${filters.radiusKm} km`
      : null,
  ].filter(Boolean) as string[];

  return (
    <Container className="space-y-10 py-16">
      <Reveal>
        <SectionHeading
          eyebrow="Listings"
          title="Searchable inventory designed for conversion and trust."
          description="Filter by city, property type, bedrooms, pricing, status, and payment-plan fit. URL query params are the source of truth so search is shareable, tenant-safe, and limited to verified or clearly stale inventory."
        />
      </Reveal>
      <form className="space-y-4" method="GET">
        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink-700)]">
            <SlidersHorizontal className="h-4 w-4 text-[var(--brand-700)]" aria-hidden />
            Refine listings
          </div>
          <div className="grid gap-4 lg:grid-cols-4">
          <PropertyLocationSearch
            defaultLocation={filters.location}
            defaultLatitude={filters.latitude}
            defaultLongitude={filters.longitude}
            defaultRadiusKm={filters.radiusKm}
          />
          <Select
            name="propertyType"
            defaultValue={filters.propertyType ?? ""}
          >
            <option value="">All property types</option>
            <option value="APARTMENT">Apartment</option>
            <option value="DUPLEX">Duplex</option>
            <option value="TERRACE">Terrace</option>
            <option value="DETACHED">Detached</option>
            <option value="SEMI_DETACHED">Semi-detached</option>
            <option value="LAND">Land</option>
            <option value="COMMERCIAL">Commercial</option>
          </Select>
          <Input name="minPrice" placeholder="Min price" defaultValue={filters.minPrice?.toString() ?? ""} />
          <Input name="maxPrice" placeholder="Max price" defaultValue={filters.maxPrice?.toString() ?? ""} />
          <Input name="bedrooms" placeholder="Bedrooms" defaultValue={filters.bedrooms?.toString() ?? ""} />
          <Select
            name="status"
            defaultValue={filters.status ?? ""}
          >
            <option value="">All statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="RESERVED">Reserved</option>
            <option value="SOLD">Sold</option>
          </Select>
          <label className="flex items-center gap-3 rounded-2xl border border-[var(--line)] px-4 text-sm text-[var(--ink-700)]">
            <input type="checkbox" name="hasPaymentPlan" value="true" defaultChecked={Boolean(filters.hasPaymentPlan)} />
            Payment plan available
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-[var(--line)] px-4 text-sm text-[var(--ink-700)]">
            <input type="checkbox" name="featured" value="true" defaultChecked={Boolean(filters.featured)} />
            Featured only
          </label>
          </div>
        </Card>
        <div className="flex flex-wrap gap-3">
          <Button type="submit">Apply filters</Button>
          <Link href="/properties">
            <Button type="button" variant="outline">Reset</Button>
          </Link>
        </div>
      </form>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-[var(--ink-950)]">
          {properties.total} listing{properties.total === 1 ? "" : "s"}
        </span>
        {(activeFilters.length > 0 ? activeFilters : ["Verified and recently updated public inventory"]).map((label) => (
          <Badge key={label}>{label}</Badge>
        ))}
      </div>
      {properties.items.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {properties.items.map((property, index) => (
            <Reveal key={property.id} delay={index * 0.05} className="h-full">
              <PropertyCard property={property} />
            </Reveal>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No matching listings"
          description="No public inventory matched the current filters for this tenant. Adjust the filters and try again."
        />
      )}
      <TopMarketersSection
        leaderboard={leaderboard}
        compact
        period={leaderboardPeriod}
        periodHrefBuilder={(period) =>
          `?${new URLSearchParams({
            ...Object.fromEntries(
              Object.entries(params).flatMap(([key, value]) =>
                typeof value === "string" && value.length > 0 ? [[key, value]] : [],
              ),
            ),
            topMarketers: period,
          }).toString()}`
        }
        title="Need a trusted closer?"
        description="These marketers are ranked from current tenant activity, with buyer-selected attribution taking precedence over assigned inquiry and inspection fallback."
      />
      <div className="flex items-center justify-between gap-4 rounded-3xl border border-[var(--line)] px-5 py-4 text-sm text-[var(--ink-600)]">
        <span>
          Showing page {properties.page} of {properties.totalPages} · {properties.total} result{properties.total === 1 ? "" : "s"}
        </span>
        <div className="flex gap-3">
          {properties.page > 1 ? (
            <Link href={`?${new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value != null && value !== false).map(([key, value]) => [key, String(value)])), page: String(properties.page - 1) }).toString()}`}>
              <Button variant="outline" size="sm">Previous</Button>
            </Link>
          ) : null}
          {properties.page < properties.totalPages ? (
            <Link href={`?${new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value != null && value !== false).map(([key, value]) => [key, String(value)])), page: String(properties.page + 1) }).toString()}`}>
              <Button variant="outline" size="sm">Next</Button>
            </Link>
          ) : null}
        </div>
      </div>
    </Container>
  );
}
