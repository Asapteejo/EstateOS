import { notFound } from "next/navigation";

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import type { TenantContext } from "@/lib/tenancy/context";
import { requirePublicTenantContext } from "@/lib/tenancy/context";
import {
  aggregateForTenant,
  findFirstForTenant,
  findManyForTenant,
  scopeTenantWhere,
} from "@/lib/tenancy/db";
import {
  propertySearchParamsSchema,
  type PropertySearchParams,
} from "@/lib/validations/properties";
import { extractBoundaryPoints } from "@/lib/maps/geojson";
import { properties as demoProperties, getPropertyBySlug } from "@/modules/properties/demo-data";
import {
  buildPropertyVerificationPresentation,
  buildPublicPropertyVerificationWhere,
} from "@/modules/properties/verification";
import type { PropertySummary } from "@/types/domain";

type ScopedFindManyDelegate = { findMany: (args?: unknown) => Promise<unknown> };
type ScopedFindFirstDelegate = { findFirst: (args?: unknown) => Promise<unknown> };
type ScopedAggregateDelegate = { aggregate: (args?: unknown) => Promise<unknown> };
type Decimalish = { toNumber?: () => number } | number;

const PUBLIC_PROPERTY_STATUSES = ["AVAILABLE", "RESERVED", "SOLD"] as const;
const PAGE_SIZE = 9;
const EARTH_RADIUS_KM = 6371;

export type PublicPropertyFilters = PropertySearchParams;
export type PublicPropertyListingResult = {
  items: PropertySummary[];
  filters: PublicPropertyFilters;
  page: number;
  total: number;
  totalPages: number;
};

export type PublicPropertyDetail = PropertySummary & {
  videoUrl?: string;
  brochureUrl?: string | null;
  brochureAvailable: boolean;
  paymentOptions: Array<{
    id: string;
    propertyUnitId: string | null;
    title: string;
    kind: string;
    description: string | null;
    scheduleDescription: string | null;
    durationMonths: number;
    installmentCount: number | null;
    depositPercent: number | null;
    downPaymentAmount: number | null;
    isActive: boolean;
    installments: Array<{
      id: string;
      title: string;
      amount: number;
      dueInDays: number;
      scheduleLabel: string | null;
      sortOrder: number;
    }>;
  }>;
  units: Array<{
    id: string;
    unitCode: string;
    title: string;
    status: string;
    price: number;
    bedrooms: number | null;
    bathrooms: number | null;
    sizeSqm: number | null;
    block: string | null;
    floor: number | null;
  }>;
};

export function resolvePublicPropertyVideoUrl(videoUrl?: string | null) {
  const trimmed = videoUrl?.trim();
  return trimmed || undefined;
}

type PropertyRow = {
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
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  parkingSpaces: number | null;
  sizeSqm: Decimalish | null;
  landSizeSqm: Decimalish | null;
  numberOfPlots: Decimalish | null;
  landSaleUnit: string | null;
  hectares: Decimalish | null;
  acres: Decimalish | null;
  plotOptions: unknown;
  offerEndsAt: Date | null;
  countdownLabel: string | null;
  countdownEnabled: boolean;
  locationSummary: string | null;
  landmarks: unknown;
  location: {
    addressLine1: string | null;
    formattedAddress: string | null;
    city: string;
    state: string;
    longitude: Decimalish | null;
    latitude: Decimalish | null;
    companyId: string;
    boundaryGeoJson: unknown;
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

type DetailPropertyRow = Omit<PropertyRow, "units" | "paymentPlans"> & {
  brochureDocumentId: string | null;
  videoUrl: string | null;
  paymentPlans: Array<{
    id: string;
    propertyUnitId: string | null;
    title: string;
    kind: string;
    description: string | null;
    scheduleDescription: string | null;
    durationMonths: number;
    installmentCount: number | null;
    depositPercent: Decimalish | null;
    downPaymentAmount: Decimalish | null;
    isActive: boolean;
    installments: Array<{
      id: string;
      title: string;
      amount: Decimalish;
      dueInDays: number;
      scheduleLabel: string | null;
      sortOrder: number;
    }>;
  }>;
  units: Array<{
    id: string;
    unitCode: string;
    title: string;
    status: string;
    price: Decimalish;
    bedrooms: number | null;
    bathrooms: number | null;
    sizeSqm: Decimalish | null;
    block: string | null;
    floor: number | null;
  }>;
};

export function normalizePlotOptions(value: unknown): PropertySummary["plotOptions"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => item != null && typeof item === "object")
    .map((item) => {
      const option: PropertySummary["plotOptions"][number] = {};
      if (typeof item.label === "string") option.label = item.label;
      if (typeof item.unit === "string") option.unit = item.unit as PropertySummary["plotOptions"][number]["unit"];
      if (typeof item.sizeSqm === "number") option.sizeSqm = item.sizeSqm;
      if (typeof item.numberOfPlots === "number") option.numberOfPlots = item.numberOfPlots;
      if (typeof item.hectares === "number") option.hectares = item.hectares;
      if (typeof item.acres === "number") option.acres = item.acres;
      if (typeof item.price === "number") option.price = item.price;
      if (typeof item.currency === "string") option.currency = item.currency;
      if (typeof item.status === "string") option.status = item.status;
      if (typeof item.note === "string") option.note = item.note;
      return option;
    });
}

export function buildPublicPropertyWhere(
  context: TenantContext,
  where?: Record<string, unknown>,
  _now = new Date(),
) {
  void _now;

  return scopeTenantWhere(context, {
    AND: [
      where ?? {},
      buildPublicPropertyVerificationWhere(),
    ],
    status: {
      in: [...PUBLIC_PROPERTY_STATUSES],
    },
  });
}

export function parsePropertySearchParams(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const normalized = Object.fromEntries(
    Object.entries(searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );

  const parsed = propertySearchParamsSchema.safeParse(normalized);
  if (!parsed.success) {
    return propertySearchParamsSchema.parse({});
  }

  return parsed.data;
}

export function buildPublicPropertyFilterWhere(
  context: TenantContext,
  filters: PublicPropertyFilters,
  now = new Date(),
) {
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

  const boundingBox = buildRadiusBoundingBox(filters);
  if (boundingBox) {
    andFilters.push({
      location: {
        latitude: {
          gte: boundingBox.minLatitude,
          lte: boundingBox.maxLatitude,
        },
        longitude: {
          gte: boundingBox.minLongitude,
          lte: boundingBox.maxLongitude,
        },
      },
    });
  }

  if (filters.propertyType) {
    andFilters.push({
      propertyType: filters.propertyType,
    });
  }

  if (filters.status) {
    andFilters.push({
      status: filters.status,
    });
  }

  if (filters.featured) {
    andFilters.push({
      isFeatured: true,
    });
  }

  if (filters.hasPaymentPlan) {
    andFilters.push({
      OR: [
        { hasPaymentPlan: true },
        {
          paymentPlans: {
            some: {
              isActive: true,
            },
          },
        },
      ],
    });
  }

  if (filters.bedrooms) {
    andFilters.push({
      OR: [
        { bedrooms: { gte: filters.bedrooms } },
        { units: { some: { bedrooms: { gte: filters.bedrooms } } } },
      ],
    });
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

  return buildPublicPropertyWhere(
    context,
    andFilters.length > 0 ? { AND: andFilters } : undefined,
    now,
  );
}

export function hasRadiusPropertySearch(filters: PublicPropertyFilters) {
  return (
    filters.latitude != null &&
    filters.longitude != null &&
    filters.radiusKm != null
  );
}

export function calculateDistanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const startLatitude = toRadians(from.latitude);
  const endLatitude = toRadians(to.latitude);
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(deltaLongitude / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
}

export function buildRadiusBoundingBox(filters: PublicPropertyFilters) {
  if (!hasRadiusPropertySearch(filters)) return null;

  const latitude = filters.latitude as number;
  const longitude = filters.longitude as number;
  const radiusKm = filters.radiusKm as number;
  const latitudeDelta = radiusKm / 111.32;
  const longitudeDelta =
    radiusKm / (111.32 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.01));

  return {
    minLatitude: Math.max(-90, latitude - latitudeDelta),
    maxLatitude: Math.min(90, latitude + latitudeDelta),
    minLongitude: Math.max(-180, longitude - longitudeDelta),
    maxLongitude: Math.min(180, longitude + longitudeDelta),
  };
}

function applyRadiusFilter(rows: PropertyRow[], filters: PublicPropertyFilters) {
  if (!hasRadiusPropertySearch(filters)) return rows;

  const origin = {
    latitude: filters.latitude as number,
    longitude: filters.longitude as number,
  };
  const radiusKm = filters.radiusKm as number;

  return rows.filter((property) => {
    if (property.location?.latitude == null || property.location.longitude == null) {
      return false;
    }
    const latitude = decimalToNumber(property.location.latitude);
    const longitude = decimalToNumber(property.location.longitude);

    return calculateDistanceKm(origin, { latitude, longitude }) <= radiusKm;
  });
}

export function buildPropertyBrochureHref(slug: string) {
  return `/brochures/${slug}`;
}

export async function getPublicPropertiesContext() {
  return requirePublicTenantContext();
}

export async function getPublicProperties(
  context?: TenantContext,
  filters?: PublicPropertyFilters,
): Promise<PublicPropertyListingResult> {
  const resolvedFilters = filters ?? propertySearchParamsSchema.parse({});

  if (!featureFlags.hasDatabase || !context?.companyId) {
    return {
      items: demoProperties,
      filters: resolvedFilters,
      page: 1,
      total: demoProperties.length,
      totalPages: 1,
    };
  }

  const where = buildPublicPropertyFilterWhere(context, resolvedFilters);
  const skip = (resolvedFilters.page - 1) * PAGE_SIZE;
  const radiusSearch = hasRadiusPropertySearch(resolvedFilters);

  const [rows, totalResult] = await Promise.all([
    findManyForTenant(
      prisma.property as ScopedFindManyDelegate,
      context,
      {
        where,
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
        skip: radiusSearch ? undefined : skip,
        take: radiusSearch ? 250 : PAGE_SIZE,
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
          currency: true,
          bedrooms: true,
          bathrooms: true,
          parkingSpaces: true,
          sizeSqm: true,
          landSizeSqm: true,
          numberOfPlots: true,
          landSaleUnit: true,
          hectares: true,
          acres: true,
          plotOptions: true,
          offerEndsAt: true,
          countdownLabel: true,
          countdownEnabled: true,
          locationSummary: true,
          landmarks: true,
          location: {
            select: {
              addressLine1: true,
              formattedAddress: true,
              city: true,
              state: true,
              longitude: true,
              latitude: true,
              boundaryGeoJson: true,
              companyId: true,
            },
          },
          media: {
            where: {
              visibility: "PUBLIC",
            },
            orderBy: {
              sortOrder: "asc",
            },
            select: {
              url: true,
            },
          },
          paymentPlans: {
            where: {
              isActive: true,
            },
            orderBy: {
              createdAt: "asc",
            },
            take: 1,
            select: {
              title: true,
              description: true,
              durationMonths: true,
              depositPercent: true,
            },
          },
          features: {
            orderBy: {
              label: "asc",
            },
            select: {
              label: true,
            },
          },
          inquiries: {
            select: {
              id: true,
            },
          },
          units: {
            where: {
              status: {
                in: [...PUBLIC_PROPERTY_STATUSES],
              },
            },
            select: {
              price: true,
              bedrooms: true,
              status: true,
            },
          },
        },
      } as Parameters<typeof prisma.property.findMany>[0],
    ),
    aggregateForTenant(
      prisma.property as ScopedAggregateDelegate,
      context,
      {
        where,
        _count: {
          id: true,
        },
      } as Parameters<typeof prisma.property.aggregate>[0],
    ),
  ]);

  const typedRows = (rows as PropertyRow[]).filter(
    (property) => property.location?.companyId === context.companyId,
  );
  const radiusFilteredRows = applyRadiusFilter(typedRows, resolvedFilters);
  const total = radiusSearch ? radiusFilteredRows.length : Number(
    (
      totalResult as {
        _count: { id: number | null };
      }
    )._count.id ?? 0,
  );
  const pageRows = radiusSearch ? radiusFilteredRows.slice(skip, skip + PAGE_SIZE) : radiusFilteredRows;

  return {
    items: pageRows.map((property) => mapPropertyRowToSummary(property)),
    filters: resolvedFilters,
    page: resolvedFilters.page,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getPublicPropertyDetailBySlug(
  slug: string,
  context?: TenantContext,
): Promise<PublicPropertyDetail> {
  if (!featureFlags.hasDatabase || !context?.companyId) {
    const property = getPropertyBySlug(slug);
    if (!property) {
      notFound();
    }

    return {
      ...property,
      brochureAvailable: true,
      brochureUrl: buildPropertyBrochureHref(property.slug),
      videoUrl: undefined,
      paymentOptions: [],
      units: [],
    };
  }

  const property = (await findFirstForTenant(
    prisma.property as ScopedFindFirstDelegate,
    context,
    {
      where: buildPublicPropertyWhere(context, { slug }),
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
        currency: true,
        bedrooms: true,
        bathrooms: true,
        parkingSpaces: true,
        sizeSqm: true,
        landSizeSqm: true,
        numberOfPlots: true,
        landSaleUnit: true,
        hectares: true,
        acres: true,
        plotOptions: true,
        offerEndsAt: true,
        countdownLabel: true,
        countdownEnabled: true,
        locationSummary: true,
        landmarks: true,
        videoUrl: true,
        brochureDocumentId: true,
        location: {
          select: {
            addressLine1: true,
            formattedAddress: true,
            city: true,
            state: true,
            longitude: true,
            latitude: true,
            boundaryGeoJson: true,
            companyId: true,
          },
        },
        media: {
          where: {
            visibility: "PUBLIC",
          },
          orderBy: {
            sortOrder: "asc",
          },
          select: {
            url: true,
          },
        },
        paymentPlans: {
          where: {
            isActive: true,
          },
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
            propertyUnitId: true,
            title: true,
            kind: true,
            description: true,
            scheduleDescription: true,
            durationMonths: true,
            installmentCount: true,
            depositPercent: true,
            downPaymentAmount: true,
            isActive: true,
            installments: {
              orderBy: {
                sortOrder: "asc",
              },
              select: {
                id: true,
                title: true,
                amount: true,
                dueInDays: true,
                scheduleLabel: true,
                sortOrder: true,
              },
            },
          },
        },
        features: {
          orderBy: {
            label: "asc",
          },
          select: {
            label: true,
          },
        },
        inquiries: {
          select: {
            id: true,
          },
        },
        units: {
          where: {
            status: {
              in: [...PUBLIC_PROPERTY_STATUSES],
            },
          },
          orderBy: [{ status: "asc" }, { price: "asc" }],
          select: {
            id: true,
            unitCode: true,
            title: true,
            status: true,
            price: true,
            bedrooms: true,
            bathrooms: true,
            sizeSqm: true,
            block: true,
            floor: true,
          },
        },
      },
    } as Parameters<typeof prisma.property.findFirst>[0],
  )) as DetailPropertyRow | null;

  if (
    !property ||
    property.slug !== slug ||
    property.location?.companyId !== context.companyId
  ) {
    notFound();
  }

  const brochureAvailable = await hasPublicBrochure(context, property.brochureDocumentId);

  return {
    ...mapPropertyRowToSummary(property),
    brochureAvailable,
    brochureUrl: brochureAvailable ? buildPropertyBrochureHref(property.slug) : null,
    videoUrl: resolvePublicPropertyVideoUrl(property.videoUrl),
    paymentOptions: property.paymentPlans.map((plan) => ({
      id: plan.id,
      propertyUnitId: plan.propertyUnitId,
      title: plan.title,
      kind: plan.kind,
      description: plan.description,
      scheduleDescription: plan.scheduleDescription,
      durationMonths: plan.durationMonths,
      installmentCount: plan.installmentCount,
      depositPercent: plan.depositPercent == null ? null : decimalToNumber(plan.depositPercent),
      downPaymentAmount:
        plan.downPaymentAmount == null ? null : decimalToNumber(plan.downPaymentAmount),
      isActive: plan.isActive,
      installments: plan.installments.map((installment) => ({
        id: installment.id,
        title: installment.title,
        amount: decimalToNumber(installment.amount),
        dueInDays: installment.dueInDays,
        scheduleLabel: installment.scheduleLabel,
        sortOrder: installment.sortOrder,
      })),
    })),
    units: property.units.map((unit) => ({
      id: unit.id,
      unitCode: unit.unitCode,
      title: unit.title,
      status: unit.status,
      price: decimalToNumber(unit.price),
      bedrooms: unit.bedrooms,
      bathrooms: unit.bathrooms,
      sizeSqm: unit.sizeSqm == null ? null : decimalToNumber(unit.sizeSqm),
      block: unit.block,
      floor: unit.floor,
    })),
  };
}

export async function getPublicBrochureByPropertySlug(
  slug: string,
  context?: TenantContext,
) {
  if (!featureFlags.hasDatabase || !context?.companyId) {
    const property = getPropertyBySlug(slug);
    if (!property) {
      notFound();
    }

    return {
      fileName: property.brochureName,
      storageKey: `demo/brochures/${property.brochureName}`,
      mimeType: "application/pdf",
    };
  }

  const property = (await findFirstForTenant(
    prisma.property as ScopedFindFirstDelegate,
    context,
    {
      where: buildPublicPropertyWhere(context, {
        slug,
      }),
      select: {
        brochureDocumentId: true,
      },
    } as Parameters<typeof prisma.property.findFirst>[0],
  )) as { brochureDocumentId: string | null } | null;

  if (!property?.brochureDocumentId) {
    notFound();
  }

  const document = (await findFirstForTenant(
    prisma.document as ScopedFindFirstDelegate,
    context,
    {
      where: {
        id: property.brochureDocumentId,
        documentType: "BROCHURE",
        visibility: "PUBLIC",
      },
      select: {
        fileName: true,
        storageKey: true,
        mimeType: true,
      },
    } as Parameters<typeof prisma.document.findFirst>[0],
  )) as {
    fileName: string;
    storageKey: string;
    mimeType: string | null;
  } | null;

  if (!document) {
    notFound();
  }

  return document;
}

async function hasPublicBrochure(
  context: TenantContext,
  brochureDocumentId?: string | null,
) {
  if (!brochureDocumentId) {
    return false;
  }

  const document = (await findFirstForTenant(
    prisma.document as ScopedFindFirstDelegate,
    context,
    {
      where: {
        id: brochureDocumentId,
        documentType: "BROCHURE",
        visibility: "PUBLIC",
      },
      select: {
        id: true,
      },
    } as Parameters<typeof prisma.document.findFirst>[0],
  )) as { id: string } | null;

  return Boolean(document);
}

function mapPropertyRowToSummary(property: PropertyRow): PropertySummary {
  const paymentPlan = property.paymentPlans[0];
  const hasCoordinates = property.location?.longitude != null && property.location?.latitude != null;
  const longitude = property.location?.longitude == null ? 0 : decimalToNumber(property.location.longitude);
  const latitude = property.location?.latitude == null ? 0 : decimalToNumber(property.location.latitude);
  const unitPrices = property.units.map((unit) => decimalToNumber(unit.price));
  const minUnitPrice = unitPrices.length > 0 ? Math.min(...unitPrices) : null;
  const maxUnitPrice = unitPrices.length > 0 ? Math.max(...unitPrices) : null;
  const unitBedrooms = property.units
    .map((unit) => unit.bedrooms ?? 0)
    .filter((bedrooms) => bedrooms > 0);
  const verification = buildPropertyVerificationPresentation({
    lastVerifiedAt: property.lastVerifiedAt,
    verificationStatus: property.verificationStatus,
    verificationDueAt: property.verificationDueAt,
    isPubliclyVisible: property.isPubliclyVisible,
    autoHiddenAt: property.autoHiddenAt,
  });

  return {
    id: property.id,
    slug: property.slug,
    title: property.title,
    shortDescription: property.shortDescription,
    description: property.description,
    type: property.propertyType.replaceAll("_", " "),
    status: property.status.toLowerCase() as PropertySummary["status"],
    featured: property.isFeatured,
    priceFrom: minUnitPrice ?? decimalToNumber(property.priceFrom),
    priceTo:
      maxUnitPrice ??
      (property.priceTo == null ? undefined : decimalToNumber(property.priceTo)),
    currency: property.currency,
    bedrooms:
      unitBedrooms.length > 0 ? Math.max(...unitBedrooms) : property.bedrooms ?? 0,
    bathrooms: property.bathrooms ?? 0,
    parkingSpaces: property.parkingSpaces ?? 0,
    sizeSqm: property.sizeSqm == null ? 0 : decimalToNumber(property.sizeSqm),
    landSizeSqm: property.landSizeSqm == null ? undefined : decimalToNumber(property.landSizeSqm),
    numberOfPlots: property.numberOfPlots == null ? undefined : decimalToNumber(property.numberOfPlots),
    landSaleUnit: property.landSaleUnit as PropertySummary["landSaleUnit"],
    hectares: property.hectares == null ? undefined : decimalToNumber(property.hectares),
    acres: property.acres == null ? undefined : decimalToNumber(property.acres),
    plotOptions: normalizePlotOptions(property.plotOptions),
    countdown:
      property.countdownEnabled && property.offerEndsAt
        ? {
            enabled: true,
            label: property.countdownLabel ?? "Offer ends in",
            offerEndsAt: property.offerEndsAt.toISOString(),
          }
        : undefined,
    locationSummary:
      property.locationSummary ??
      `${property.location?.city ?? "Unknown"}, ${property.location?.state ?? "Unknown"}`,
    city: property.location?.city ?? "Unknown",
    state: property.location?.state ?? "Unknown",
    formattedAddress: property.location?.formattedAddress ?? property.location?.addressLine1 ?? undefined,
    coordinates: [longitude, latitude],
    hasCoordinates,
    boundaryCoordinates: extractBoundaryPoints(property.location?.boundaryGeoJson),
    images: property.media.map((item) => item.url),
    paymentPlan: {
      title: paymentPlan?.title ?? "Flexible payment plan",
      summary: paymentPlan?.description ?? "Structured payment options available.",
      durationMonths: paymentPlan?.durationMonths ?? 0,
      depositPercent:
        paymentPlan?.depositPercent == null ? 0 : decimalToNumber(paymentPlan.depositPercent),
    },
    features: property.features.map((feature) => feature.label),
    landmarks: Array.isArray(property.landmarks)
      ? property.landmarks.filter((item): item is string => typeof item === "string")
      : [],
    brochureName: `${property.slug}-brochure.pdf`,
    inquiryCount: property.inquiries.length,
    verification: {
      status: verification.status,
      label: verification.label,
      detail: verification.detail,
      tone: verification.tone,
      isPubliclyVisible: verification.isPubliclyVisible,
      lastVerifiedAt: verification.lastVerifiedAt?.toISOString(),
      verificationDueAt: verification.verificationDueAt.toISOString(),
    },
  };
}

function decimalToNumber(value: Decimalish) {
  return typeof value === "number" ? value : value.toNumber?.() ?? Number(value);
}
