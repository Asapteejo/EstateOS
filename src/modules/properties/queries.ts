import { notFound } from "next/navigation";

import { prisma } from "@/lib/db/prisma";
import { env, featureFlags } from "@/lib/env";
import type { TenantContext } from "@/lib/tenancy/context";
import { requirePublicTenantContext } from "@/lib/tenancy/context";
import { findFirstForTenant, findManyForTenant, scopeTenantWhere } from "@/lib/tenancy/db";
import { properties as demoProperties, getPropertyBySlug } from "@/modules/properties/demo-data";
import type { PropertySummary } from "@/types/domain";

type ScopedFindManyDelegate = { findMany: (args?: unknown) => Promise<unknown> };
type ScopedFindFirstDelegate = { findFirst: (args?: unknown) => Promise<unknown> };

export type PublicPropertyDetail = PropertySummary & {
  videoUrl?: string;
  brochureUrl?: string | null;
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

export function buildPublicPropertyWhere(
  context: TenantContext,
  where?: Record<string, unknown>,
) {
  return scopeTenantWhere(context, {
    ...(where ?? {}),
    status: {
      in: ["AVAILABLE", "RESERVED", "SOLD"],
    },
  });
}

export async function getPublicPropertiesContext() {
  return requirePublicTenantContext();
}

export async function getPublicProperties(context?: TenantContext): Promise<PropertySummary[]> {
  if (!featureFlags.hasDatabase || !context?.companyId) {
    return demoProperties;
  }

  const rows = (await findManyForTenant(
    prisma.property as ScopedFindManyDelegate,
    context,
    {
      where: buildPublicPropertyWhere(context),
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        shortDescription: true,
        description: true,
        propertyType: true,
        status: true,
        isFeatured: true,
        priceFrom: true,
        priceTo: true,
        bedrooms: true,
        bathrooms: true,
        parkingSpaces: true,
        sizeSqm: true,
        locationSummary: true,
        landmarks: true,
        location: {
          select: {
            city: true,
            state: true,
            longitude: true,
            latitude: true,
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
      },
    } as Parameters<typeof prisma.property.findMany>[0],
  )) as PropertyRow[];

  return rows
    .filter((property) => property.location?.companyId === context.companyId)
    .map((property) => mapPropertyRowToSummary(property));
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
      brochureUrl: "/brochure",
      videoUrl: undefined,
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
        priceFrom: true,
        priceTo: true,
        bedrooms: true,
        bathrooms: true,
        parkingSpaces: true,
        sizeSqm: true,
        locationSummary: true,
        landmarks: true,
        videoUrl: true,
        brochureDocumentId: true,
        location: {
          select: {
            city: true,
            state: true,
            longitude: true,
            latitude: true,
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
              in: ["AVAILABLE", "RESERVED", "SOLD"],
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
  )) as (PropertyRow & {
    videoUrl: string | null;
    brochureDocumentId: string | null;
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
  }) | null;

  if (!property || property.location?.companyId !== context.companyId) {
    notFound();
  }

  const brochureUrl =
    property.brochureDocumentId == null
      ? null
      : await getPublicBrochureUrl(context, property.brochureDocumentId);

  return {
    ...mapPropertyRowToSummary(property),
    brochureUrl,
    videoUrl: property.videoUrl ?? undefined,
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

async function getPublicBrochureUrl(context: TenantContext, documentId: string) {
  const document = (await findFirstForTenant(
    prisma.document as ScopedFindFirstDelegate,
    context,
    {
      where: {
        id: documentId,
        documentType: "BROCHURE",
        visibility: "PUBLIC",
      },
      select: {
        storageKey: true,
      },
    } as Parameters<typeof prisma.document.findFirst>[0],
  )) as { storageKey: string } | null;

  if (!document) {
    return null;
  }

  if (env.R2_PUBLIC_BASE_URL) {
    return `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${document.storageKey}`;
  }

  return "/brochure";
}

type Decimalish = { toNumber?: () => number } | number;
type PropertyRow = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  propertyType: string;
  status: string;
  isFeatured: boolean;
  priceFrom: Decimalish;
  priceTo: Decimalish | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parkingSpaces: number | null;
  sizeSqm: Decimalish | null;
  locationSummary: string | null;
  landmarks: unknown;
  location: {
    city: string;
    state: string;
    longitude: Decimalish | null;
    latitude: Decimalish | null;
    companyId: string;
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
};

function mapPropertyRowToSummary(property: PropertyRow): PropertySummary {
  const paymentPlan = property.paymentPlans[0];

  return {
    id: property.id,
    slug: property.slug,
    title: property.title,
    shortDescription: property.shortDescription,
    description: property.description,
    type: property.propertyType.replaceAll("_", " "),
    status: property.status.toLowerCase() as PropertySummary["status"],
    featured: property.isFeatured,
    priceFrom: decimalToNumber(property.priceFrom),
    priceTo: property.priceTo == null ? undefined : decimalToNumber(property.priceTo),
    bedrooms: property.bedrooms ?? 0,
    bathrooms: property.bathrooms ?? 0,
    parkingSpaces: property.parkingSpaces ?? 0,
    sizeSqm: property.sizeSqm == null ? 0 : decimalToNumber(property.sizeSqm),
    locationSummary:
      property.locationSummary ??
      `${property.location?.city ?? "Unknown"}, ${property.location?.state ?? "Unknown"}`,
    city: property.location?.city ?? "Unknown",
    state: property.location?.state ?? "Unknown",
    coordinates: [
      property.location?.longitude == null ? 0 : decimalToNumber(property.location.longitude),
      property.location?.latitude == null ? 0 : decimalToNumber(property.location.latitude),
    ],
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
    brochureName: "brochure.pdf",
    inquiryCount: property.inquiries.length,
  };
}

function decimalToNumber(value: Decimalish) {
  return typeof value === "number" ? value : value.toNumber?.() ?? Number(value);
}
