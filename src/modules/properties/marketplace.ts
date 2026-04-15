/**
 * Cross-company property marketplace.
 *
 * Queries verified, publicly-listed properties across ALL EstateOS tenants
 * without any single-company scoping. Companies opt a property into the
 * marketplace by setting `isMarketplaceListed = true` via the admin listings
 * page. The usual visibility gates still apply: `isPubliclyVisible` must be
 * true and `verificationStatus` must be VERIFIED or STALE.
 */

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { buildPublicPropertyVerificationWhere } from "@/modules/properties/verification";
import type { PropertySummary } from "@/types/domain";

// ─── Types ───────────────────────────────────────────────────────────────────

export type MarketplacePropertySummary = PropertySummary & {
  companySlug: string;
  companyName: string;
  companyLogoUrl: string | null;
};

export type MarketplaceFilters = {
  location?: string;
  propertyType?: string;
  minPrice?: number;
  maxPrice?: number;
  page: number;
};

export type MarketplaceListingResult = {
  items: MarketplacePropertySummary[];
  filters: MarketplaceFilters;
  page: number;
  total: number;
  totalPages: number;
};

export type MarketplaceStats = {
  totalProperties: number;
  totalCompanies: number;
  totalCities: string[];
};

// ─── Internal row types ───────────────────────────────────────────────────────

type Decimalish = { toNumber?: () => number } | number;

type MarketplacePropertyRow = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  propertyType: string;
  status: string;
  isFeatured: boolean;
  hasPaymentPlan: boolean;
  lastVerifiedAt: Date | null;
  verificationStatus: "VERIFIED" | "STALE" | "UNVERIFIED" | "HIDDEN";
  verificationDueAt: Date;
  isPubliclyVisible: boolean;
  autoHiddenAt: Date | null;
  priceFrom: Decimalish;
  priceTo: Decimalish | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parkingSpaces: number | null;
  sizeSqm: Decimalish | null;
  locationSummary: string | null;
  landmarks: unknown;
  company: {
    slug: string;
    name: string;
    logoUrl: string | null;
  };
  location: {
    city: string;
    state: string;
    longitude: Decimalish | null;
    latitude: Decimalish | null;
  } | null;
  media: Array<{ url: string }>;
  paymentPlans: Array<{
    title: string;
    description: string | null;
    durationMonths: number;
    depositPercent: Decimalish | null;
  }>;
  features: Array<{ label: string }>;
  inquiries: Array<{ id: string }>;
  units: Array<{
    price: Decimalish;
    bedrooms: number | null;
    status: string;
  }>;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12;
const PUBLIC_STATUSES = ["AVAILABLE", "RESERVED"] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function decimalToNumber(value: Decimalish): number {
  return typeof value === "number" ? value : value.toNumber?.() ?? Number(value);
}

function buildMarketplaceWhere(filters: MarketplaceFilters) {
  const verificationWhere = buildPublicPropertyVerificationWhere();

  const andFilters: Array<Record<string, unknown>> = [];

  if (filters.location) {
    andFilters.push({
      OR: [
        { locationSummary: { contains: filters.location, mode: "insensitive" } },
        { location: { city: { contains: filters.location, mode: "insensitive" } } },
        { location: { state: { contains: filters.location, mode: "insensitive" } } },
        { title: { contains: filters.location, mode: "insensitive" } },
      ],
    });
  }

  if (filters.propertyType) {
    andFilters.push({ propertyType: filters.propertyType });
  }

  if (filters.minPrice != null) {
    andFilters.push({
      OR: [
        { priceFrom: { gte: filters.minPrice } },
        { units: { some: { price: { gte: filters.minPrice } } } },
      ],
    });
  }

  if (filters.maxPrice != null) {
    andFilters.push({
      OR: [
        { priceFrom: { lte: filters.maxPrice } },
        { priceTo: { lte: filters.maxPrice } },
        { units: { some: { price: { lte: filters.maxPrice } } } },
      ],
    });
  }

  return {
    isMarketplaceListed: true,
    ...verificationWhere,
    status: { in: [...PUBLIC_STATUSES] },
    ...(andFilters.length > 0 ? { AND: andFilters } : {}),
  };
}

function mapRowToMarketplaceSummary(row: MarketplacePropertyRow): MarketplacePropertySummary {
  const paymentPlan = row.paymentPlans[0];
  const unitPrices = row.units.map((u) => decimalToNumber(u.price));
  const minUnitPrice = unitPrices.length > 0 ? Math.min(...unitPrices) : null;
  const maxUnitPrice = unitPrices.length > 0 ? Math.max(...unitPrices) : null;
  const unitBedrooms = row.units
    .map((u) => u.bedrooms ?? 0)
    .filter((b) => b > 0);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortDescription: row.shortDescription,
    description: row.description,
    type: row.propertyType.replaceAll("_", " "),
    status: row.status.toLowerCase() as PropertySummary["status"],
    featured: row.isFeatured,
    priceFrom: minUnitPrice ?? decimalToNumber(row.priceFrom),
    priceTo:
      maxUnitPrice ??
      (row.priceTo == null ? undefined : decimalToNumber(row.priceTo)),
    bedrooms: unitBedrooms.length > 0 ? Math.max(...unitBedrooms) : row.bedrooms ?? 0,
    bathrooms: row.bathrooms ?? 0,
    parkingSpaces: row.parkingSpaces ?? 0,
    sizeSqm: row.sizeSqm == null ? 0 : decimalToNumber(row.sizeSqm),
    locationSummary:
      row.locationSummary ??
      `${row.location?.city ?? "Unknown"}, ${row.location?.state ?? "Unknown"}`,
    city: row.location?.city ?? "Unknown",
    state: row.location?.state ?? "Unknown",
    coordinates: [
      row.location?.longitude == null ? 0 : decimalToNumber(row.location.longitude),
      row.location?.latitude == null ? 0 : decimalToNumber(row.location.latitude),
    ],
    images: row.media.map((m) => m.url),
    paymentPlan: {
      title: paymentPlan?.title ?? "Flexible payment plan",
      summary: paymentPlan?.description ?? "Structured payment options available.",
      durationMonths: paymentPlan?.durationMonths ?? 0,
      depositPercent:
        paymentPlan?.depositPercent == null
          ? 0
          : decimalToNumber(paymentPlan.depositPercent),
    },
    features: row.features.map((f) => f.label),
    landmarks: Array.isArray(row.landmarks)
      ? row.landmarks.filter((item): item is string => typeof item === "string")
      : [],
    brochureName: `${row.slug}-brochure.pdf`,
    inquiryCount: row.inquiries.length,
    verification: {
      status: row.verificationStatus,
      label:
        row.verificationStatus === "VERIFIED" ? "Independently verified" : "Recently stale",
      detail: row.lastVerifiedAt
        ? `Last verified ${row.lastVerifiedAt.toLocaleDateString()}`
        : "Verification pending",
      tone: row.verificationStatus === "VERIFIED" ? "success" : "warning",
      isPubliclyVisible: row.isPubliclyVisible,
      lastVerifiedAt: row.lastVerifiedAt?.toISOString(),
      verificationDueAt: row.verificationDueAt.toISOString(),
    },
    // Marketplace extras
    companySlug: row.company.slug,
    companyName: row.company.name,
    companyLogoUrl: row.company.logoUrl,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getMarketplaceProperties(
  filters: MarketplaceFilters,
): Promise<MarketplaceListingResult> {
  if (!featureFlags.hasDatabase) {
    return { items: [], filters, page: 1, total: 0, totalPages: 1 };
  }

  const where = buildMarketplaceWhere(filters);
  const skip = (filters.page - 1) * PAGE_SIZE;

  const [rows, total] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.property.findMany as (args: any) => Promise<any>)({
      where,
      orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        title: true,
        shortDescription: true,
        description: true,
        propertyType: true,
        status: true,
        isFeatured: true,
        hasPaymentPlan: true,
        lastVerifiedAt: true,
        verificationStatus: true,
        verificationDueAt: true,
        isPubliclyVisible: true,
        autoHiddenAt: true,
        priceFrom: true,
        priceTo: true,
        bedrooms: true,
        bathrooms: true,
        parkingSpaces: true,
        sizeSqm: true,
        locationSummary: true,
        landmarks: true,
        company: {
          select: { slug: true, name: true, logoUrl: true },
        },
        location: {
          select: { city: true, state: true, longitude: true, latitude: true },
        },
        media: {
          where: { visibility: "PUBLIC" },
          orderBy: { sortOrder: "asc" },
          select: { url: true },
        },
        paymentPlans: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: {
            title: true,
            description: true,
            durationMonths: true,
            depositPercent: true,
          },
        },
        features: {
          orderBy: { label: "asc" },
          select: { label: true },
        },
        inquiries: { select: { id: true } },
        units: {
          where: { status: { in: [...PUBLIC_STATUSES] } },
          select: { price: true, bedrooms: true, status: true },
        },
      },
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.property.count as (args: any) => Promise<number>)({ where }),
  ]);

  return {
    items: (rows as unknown as MarketplacePropertyRow[]).map(mapRowToMarketplaceSummary),
    filters,
    page: filters.page,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getMarketplacePropertyDetail(
  companySlug: string,
  propertySlug: string,
): Promise<(MarketplacePropertySummary & { videoUrl?: string }) | null> {
  if (!featureFlags.hasDatabase) return null;

  const verificationWhere = buildPublicPropertyVerificationWhere();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = (await (prisma.property.findFirst as (args: any) => Promise<any>)({
    where: {
      slug: propertySlug,
      isMarketplaceListed: true,
      ...verificationWhere,
      status: { in: [...PUBLIC_STATUSES] },
      company: { slug: companySlug },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      shortDescription: true,
      description: true,
      propertyType: true,
      status: true,
      isFeatured: true,
      hasPaymentPlan: true,
      lastVerifiedAt: true,
      verificationStatus: true,
      verificationDueAt: true,
      isPubliclyVisible: true,
      autoHiddenAt: true,
      priceFrom: true,
      priceTo: true,
      bedrooms: true,
      bathrooms: true,
      parkingSpaces: true,
      sizeSqm: true,
      locationSummary: true,
      landmarks: true,
      videoUrl: true,
      company: {
        select: { slug: true, name: true, logoUrl: true },
      },
      location: {
        select: { city: true, state: true, longitude: true, latitude: true },
      },
      media: {
        where: { visibility: "PUBLIC" },
        orderBy: { sortOrder: "asc" },
        select: { url: true },
      },
      paymentPlans: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: {
          title: true,
          description: true,
          durationMonths: true,
          depositPercent: true,
        },
      },
      features: {
        orderBy: { label: "asc" },
        select: { label: true },
      },
      inquiries: { select: { id: true } },
      units: {
        where: { status: { in: [...PUBLIC_STATUSES] } },
        select: { price: true, bedrooms: true, status: true },
      },
    },
  })) as unknown as (MarketplacePropertyRow & { videoUrl?: string | null }) | null;

  if (!row) return null;

  return {
    ...mapRowToMarketplaceSummary(row),
    videoUrl: row.videoUrl ?? undefined,
  };
}

export async function getMarketplaceStats(): Promise<MarketplaceStats> {
  if (!featureFlags.hasDatabase) {
    return { totalProperties: 0, totalCompanies: 0, totalCities: [] };
  }

  const verificationWhere = buildPublicPropertyVerificationWhere();

  const marketplaceWhere = {
    isMarketplaceListed: true,
    ...verificationWhere,
    status: { in: [...PUBLIC_STATUSES] },
  };

  const [properties, locationRows] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.property.groupBy as (args: any) => Promise<any[]>)({
      by: ["companyId"],
      where: marketplaceWhere,
      _count: { id: true },
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.propertyLocation.findMany as (args: any) => Promise<any[]>)({
      where: { property: marketplaceWhere },
      select: { city: true },
      distinct: ["city"],
      orderBy: { city: "asc" },
    }),
  ]);

  const totalProperties = properties.reduce((sum, g) => sum + (g._count.id ?? 0), 0);

  return {
    totalProperties,
    totalCompanies: properties.length,
    totalCities: locationRows.map((r) => r.city),
  };
}

export function parseMarketplaceSearchParams(
  params: Record<string, string | string[] | undefined>,
): MarketplaceFilters {
  const str = (key: string) => {
    const v = params[key];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  const num = (key: string) => {
    const v = str(key);
    if (!v) return undefined;
    const n = parseFloat(v);
    return isNaN(n) ? undefined : n;
  };

  return {
    location: str("location"),
    propertyType: str("propertyType"),
    minPrice: num("minPrice"),
    maxPrice: num("maxPrice"),
    page: Math.max(1, parseInt(str("page") ?? "1", 10) || 1),
  };
}

// ─── Admin helpers ────────────────────────────────────────────────────────────

export type AdminMarketplaceRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  propertyType: string;
  locationSummary: string | null;
  priceFrom: number;
  isMarketplaceListed: boolean;
  isPubliclyVisible: boolean;
  verificationStatus: string;
};

export async function getAdminMarketplaceRows(companyId: string): Promise<AdminMarketplaceRow[]> {
  if (!featureFlags.hasDatabase) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (await (prisma.property.findMany as (args: any) => Promise<any[]>)({
    where: { companyId, status: { notIn: ["ARCHIVED"] } },
    orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      propertyType: true,
      locationSummary: true,
      priceFrom: true,
      isMarketplaceListed: true,
      isPubliclyVisible: true,
      verificationStatus: true,
    },
  })) as Array<{
    id: string;
    title: string;
    slug: string;
    status: string;
    propertyType: string;
    locationSummary: string | null;
    priceFrom: Decimalish;
    isMarketplaceListed: boolean;
    isPubliclyVisible: boolean;
    verificationStatus: string;
  }>;

  return rows.map((r) => ({
    ...r,
    priceFrom: decimalToNumber(r.priceFrom),
  }));
}

export async function toggleMarketplaceListing(
  propertyId: string,
  companyId: string,
  listed: boolean,
): Promise<void> {
  if (!featureFlags.hasDatabase) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.property.updateMany as (args: any) => Promise<any>)({
    where: { id: propertyId, companyId },
    data: { isMarketplaceListed: listed },
  });
}
