import Link from "next/link";

import { MarketplacePropertyCard } from "@/components/platform/marketplace-property-card";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import {
  getMarketplaceProperties,
  getMarketplaceStats,
  parseMarketplaceSearchParams,
} from "@/modules/properties/marketplace";

const PROPERTY_TYPE_OPTIONS = [
  ["", "All types"],
  ["APARTMENT", "Apartment"],
  ["DUPLEX", "Duplex"],
  ["TERRACE", "Terrace"],
  ["DETACHED", "Detached"],
  ["SEMI_DETACHED", "Semi-detached"],
  ["LAND", "Land"],
  ["COMMERCIAL", "Commercial"],
] as const;

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseMarketplaceSearchParams(params);

  const [listing, stats] = await Promise.all([
    getMarketplaceProperties(filters),
    getMarketplaceStats(),
  ]);

  const activeFilters = [
    filters.location ? `Location: ${filters.location}` : null,
    filters.propertyType
      ? `Type: ${filters.propertyType.replaceAll("_", " ")}`
      : null,
    filters.minPrice != null ? `Min: ${formatCurrency(filters.minPrice)}` : null,
    filters.maxPrice != null ? `Max: ${formatCurrency(filters.maxPrice)}` : null,
  ].filter(Boolean) as string[];

  const paginationParams = (page: number) => {
    const entries: [string, string][] = [];
    if (filters.location) entries.push(["location", filters.location]);
    if (filters.propertyType) entries.push(["propertyType", filters.propertyType]);
    if (filters.minPrice != null) entries.push(["minPrice", String(filters.minPrice)]);
    if (filters.maxPrice != null) entries.push(["maxPrice", String(filters.maxPrice)]);
    entries.push(["page", String(page)]);
    return new URLSearchParams(entries).toString();
  };

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="border-b border-[var(--line)] bg-[var(--sand-50)]">
        <Container className="py-16">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--ink-400)]">
              EstateOS Marketplace
            </p>
            <h1 className="mt-3 font-serif text-5xl font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--ink-950)]">
              Verified properties.<br />Every trusted agency.
            </h1>
            <p className="mt-5 text-lg leading-8 text-[var(--ink-600)]">
              Browse independently verified listings from{" "}
              {stats.totalCompanies > 0 ? (
                <strong className="text-[var(--ink-950)]">{stats.totalCompanies} agencies</strong>
              ) : (
                "top agencies"
              )}{" "}
              across Nigeria — all on one platform.
            </p>
          </div>

          {stats.totalProperties > 0 && (
            <div className="mt-10 flex flex-wrap gap-8">
              <div>
                <div className="text-3xl font-semibold text-[var(--ink-950)]">
                  {stats.totalProperties}
                </div>
                <div className="mt-0.5 text-sm text-[var(--ink-500)]">Active listings</div>
              </div>
              <div>
                <div className="text-3xl font-semibold text-[var(--ink-950)]">
                  {stats.totalCompanies}
                </div>
                <div className="mt-0.5 text-sm text-[var(--ink-500)]">Verified agencies</div>
              </div>
              <div>
                <div className="text-3xl font-semibold text-[var(--ink-950)]">
                  {stats.totalCities.length}
                </div>
                <div className="mt-0.5 text-sm text-[var(--ink-500)]">Cities covered</div>
              </div>
            </div>
          )}
        </Container>
      </div>

      {/* ── Search & results ─────────────────────────────────────────────── */}
      <Container className="space-y-8 py-12">

        {/* Filter form */}
        <form method="GET" className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_200px_160px_160px_auto]">
            <Input
              name="location"
              placeholder="Search city, state, or title"
              defaultValue={filters.location ?? ""}
            />
            <select
              name="propertyType"
              defaultValue={filters.propertyType ?? ""}
              className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
            >
              {PROPERTY_TYPE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <Input
              name="minPrice"
              type="number"
              placeholder="Min price"
              defaultValue={filters.minPrice?.toString() ?? ""}
            />
            <Input
              name="maxPrice"
              type="number"
              placeholder="Max price"
              defaultValue={filters.maxPrice?.toString() ?? ""}
            />
            <div className="flex gap-2">
              <Button type="submit" className="flex-1 sm:flex-none">
                Search
              </Button>
              <Link href="/platform/properties">
                <Button type="button" variant="outline">
                  Reset
                </Button>
              </Link>
            </div>
          </div>

          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-[var(--line)] bg-[var(--sand-50)] px-3 py-1 text-xs font-medium text-[var(--ink-600)]"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </form>

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--ink-500)]">
            {listing.total === 0
              ? "No listings matched your search"
              : `${listing.total} listing${listing.total === 1 ? "" : "s"} · page ${listing.page} of ${listing.totalPages}`}
          </p>
        </div>

        {/* Grid */}
        {listing.items.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listing.items.map((property) => (
              <MarketplacePropertyCard key={property.id} property={property} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--sand-50)] px-8 py-16 text-center">
            <p className="text-lg font-semibold text-[var(--ink-950)]">
              No listings matched your filters
            </p>
            <p className="mt-2 text-sm text-[var(--ink-500)]">
              Try broadening your search or clearing some filters.
            </p>
            <div className="mt-6">
              <Link href="/platform/properties">
                <Button variant="outline">Clear filters</Button>
              </Link>
            </div>
          </div>
        )}

        {/* Pagination */}
        {listing.totalPages > 1 && (
          <div className="flex items-center justify-between gap-4 rounded-3xl border border-[var(--line)] px-5 py-4 text-sm text-[var(--ink-600)]">
            <span>
              Page {listing.page} of {listing.totalPages}
            </span>
            <div className="flex gap-3">
              {listing.page > 1 && (
                <Link href={`?${paginationParams(listing.page - 1)}`}>
                  <Button variant="outline" size="sm">
                    Previous
                  </Button>
                </Link>
              )}
              {listing.page < listing.totalPages && (
                <Link href={`?${paginationParams(listing.page + 1)}`}>
                  <Button variant="outline" size="sm">
                    Next
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </Container>

      {/* ── CTA for agencies ─────────────────────────────────────────────── */}
      <div className="border-t border-[var(--line)] bg-[var(--ink-950)]">
        <Container className="py-16 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--sand-200)]">
            Are you an agency?
          </p>
          <h2 className="mt-4 font-serif text-4xl font-semibold text-white">
            List your properties here for free
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[var(--sand-300)]">
            EstateOS agencies can opt any verified listing into the marketplace from
            their admin dashboard — zero extra cost.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/app/onboarding">
              <Button className="bg-white text-[var(--ink-950)] hover:bg-[var(--sand-100)]">
                Create an account
              </Button>
            </Link>
            <Link href="/platform/features">
              <Button
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
              >
                Learn more
              </Button>
            </Link>
          </div>
        </Container>
      </div>
    </>
  );
}
