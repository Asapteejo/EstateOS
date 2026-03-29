import { PropertyCard } from "@/components/marketing/property-card";
import { Container } from "@/components/shared/container";
import { EmptyState } from "@/components/shared/empty-state";
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
import Link from "next/link";

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tenant = await getPublicPropertiesContext();
  const filters = parsePropertySearchParams(await searchParams);
  const properties = await getPublicProperties(tenant, filters);

  const activeFilters = [
    filters.location ? `Location: ${filters.location}` : null,
    filters.propertyType ? `Type: ${filters.propertyType.replaceAll("_", " ")}` : null,
    filters.minPrice ? `Min: ${filters.minPrice}` : null,
    filters.maxPrice ? `Max: ${filters.maxPrice}` : null,
    filters.bedrooms ? `Bedrooms: ${filters.bedrooms}+` : null,
    filters.status ? `Status: ${filters.status}` : null,
    filters.hasPaymentPlan ? "Payment plan" : null,
    filters.featured ? "Featured" : null,
  ].filter(Boolean) as string[];

  return (
    <Container className="space-y-10 py-16">
      <SectionHeading
        eyebrow="Listings"
        title="Searchable inventory designed for conversion and trust."
        description="Filter by city, property type, bedrooms, pricing, status, and payment-plan fit. URL query params are the source of truth so search is shareable and tenant-safe."
      />
      <form className="space-y-4" method="GET">
        <Card className="grid gap-4 p-5 lg:grid-cols-4">
          <Input name="location" placeholder="Location" defaultValue={filters.location ?? ""} />
          <select
            name="propertyType"
            defaultValue={filters.propertyType ?? ""}
            className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
          >
            <option value="">All property types</option>
            <option value="APARTMENT">Apartment</option>
            <option value="DUPLEX">Duplex</option>
            <option value="TERRACE">Terrace</option>
            <option value="DETACHED">Detached</option>
            <option value="SEMI_DETACHED">Semi-detached</option>
            <option value="LAND">Land</option>
            <option value="COMMERCIAL">Commercial</option>
          </select>
          <Input name="minPrice" placeholder="Min price" defaultValue={filters.minPrice?.toString() ?? ""} />
          <Input name="maxPrice" placeholder="Max price" defaultValue={filters.maxPrice?.toString() ?? ""} />
          <Input name="bedrooms" placeholder="Bedrooms" defaultValue={filters.bedrooms?.toString() ?? ""} />
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
          >
            <option value="">All statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="RESERVED">Reserved</option>
            <option value="SOLD">Sold</option>
          </select>
          <label className="flex items-center gap-3 rounded-2xl border border-[var(--line)] px-4 text-sm text-[var(--ink-700)]">
            <input type="checkbox" name="hasPaymentPlan" value="true" defaultChecked={Boolean(filters.hasPaymentPlan)} />
            Payment plan available
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-[var(--line)] px-4 text-sm text-[var(--ink-700)]">
            <input type="checkbox" name="featured" value="true" defaultChecked={Boolean(filters.featured)} />
            Featured only
          </label>
        </Card>
        <div className="flex flex-wrap gap-3">
          <Button type="submit">Apply filters</Button>
          <Link href="/properties">
            <Button type="button" variant="outline">Reset</Button>
          </Link>
        </div>
      </form>
      <div className="flex flex-wrap gap-3">
        {(activeFilters.length > 0 ? activeFilters : ["Tenant-safe public inventory"]).map((label) => (
          <Badge key={label}>{label}</Badge>
        ))}
      </div>
      {properties.items.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {properties.items.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No matching listings"
          description="No public inventory matched the current filters for this tenant. Adjust the filters and try again."
        />
      )}
      <div className="flex items-center justify-between gap-4 rounded-3xl border border-[var(--line)] px-5 py-4 text-sm text-[var(--ink-600)]">
        <span>
          Showing page {properties.page} of {properties.totalPages} · {properties.total} result(s)
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
