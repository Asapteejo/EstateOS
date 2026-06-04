import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import type { TenantContext } from "@/lib/tenancy/context";
import { findManyForTenant } from "@/lib/tenancy/db";
import { buildPropertyVerificationPresentation } from "@/modules/properties/verification";

type ScopedFindManyDelegate = { findMany: (args?: unknown) => Promise<unknown> };
type Decimalish = { toNumber?: () => number } | number;

export type AdminPropertyManagementRecord = {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  propertyType: string;
  status: string;
  isFeatured: boolean;
  priceFrom: number;
  priceTo: number | null;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  parkingSpaces: number | null;
  sizeSqm: number | null;
  landSizeSqm: number | null;
  numberOfPlots: number | null;
  landSaleUnit: "SQM" | "PLOT" | "HECTARE" | "ACRE" | "CUSTOM" | null;
  hectares: number | null;
  acres: number | null;
  plotOptions: Array<{
    label?: string;
    unit?: "SQM" | "PLOT" | "HECTARE" | "ACRE" | "CUSTOM";
    sizeSqm?: number;
    numberOfPlots?: number;
    hectares?: number;
    acres?: number;
    price?: number;
    currency?: string;
    status?: string;
    note?: string;
  }>;
  brochureDocumentId: string | null;
  videoUrl: string | null;
  offerEndsAt: string | null;
  countdownLabel: string | null;
  countdownEnabled: boolean;
  locationSummary: string | null;
  landmarks: string[];
  hasPaymentPlan: boolean;
  lastVerifiedAt: string | null;
  verificationStatus: "VERIFIED" | "STALE" | "UNVERIFIED" | "HIDDEN";
  verificationDueAt: string;
  isPubliclyVisible: boolean;
  autoHiddenAt: string | null;
  verificationNotes: string | null;
  verification: {
    label: string;
    detail: string;
    tone: "success" | "warning" | "muted";
  };
  wishlistDurationDays: number | null;
  wishlistReminderEnabled: boolean;
  location: {
    addressLine1: string | null;
    formattedAddress: string | null;
    city: string;
    state: string;
    country: string;
    latitude: number | null;
    longitude: number | null;
    mapboxPlaceId: string | null;
    boundaryGeoJson: unknown;
    neighborhood: string | null;
    postalCode: string | null;
  };
  features: Array<{ label: string; value: string | null }>;
  units: Array<{
    id: string;
    unitCode: string;
    title: string;
    status: string;
    price: number;
    bedrooms: number | null;
    bathrooms: number | null;
    sizeSqm: number | null;
    floor: number | null;
    block: string | null;
  }>;
  media: Array<{
    id: string;
    title: string | null;
    url: string;
    mimeType: string | null;
    sortOrder: number;
    isPrimary: boolean;
    visibility: string;
  }>;
  paymentPlans: Array<{
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
};

function decimalToNumber(value: Decimalish | null | undefined) {
  if (value == null) {
    return null;
  }

  return typeof value === "number" ? value : value.toNumber?.() ?? Number(value);
}

function normalizePlotOptions(value: unknown): AdminPropertyManagementRecord["plotOptions"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => item != null && typeof item === "object")
    .map((item) => ({
      label: typeof item.label === "string" ? item.label : undefined,
      unit: typeof item.unit === "string" ? item.unit as AdminPropertyManagementRecord["plotOptions"][number]["unit"] : undefined,
      sizeSqm: typeof item.sizeSqm === "number" ? item.sizeSqm : undefined,
      numberOfPlots: typeof item.numberOfPlots === "number" ? item.numberOfPlots : undefined,
      hectares: typeof item.hectares === "number" ? item.hectares : undefined,
      acres: typeof item.acres === "number" ? item.acres : undefined,
      price: typeof item.price === "number" ? item.price : undefined,
      currency: typeof item.currency === "string" ? item.currency : undefined,
      status: typeof item.status === "string" ? item.status : undefined,
      note: typeof item.note === "string" ? item.note : undefined,
    }));
}

export async function getAdminPropertyManagementList(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return [] as AdminPropertyManagementRecord[];
  }

  const properties = (await findManyForTenant(
    prisma.property as ScopedFindManyDelegate,
    context,
    {
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        title: true,
        slug: true,
        shortDescription: true,
        description: true,
        propertyType: true,
        status: true,
        isFeatured: true,
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
        brochureDocumentId: true,
        videoUrl: true,
        offerEndsAt: true,
        countdownLabel: true,
        countdownEnabled: true,
        locationSummary: true,
        landmarks: true,
        hasPaymentPlan: true,
        lastVerifiedAt: true,
        verificationStatus: true,
        verificationDueAt: true,
        isPubliclyVisible: true,
        autoHiddenAt: true,
        verificationNotes: true,
        wishlistDurationDays: true,
        wishlistReminderEnabled: true,
        location: {
          select: {
            addressLine1: true,
            formattedAddress: true,
            city: true,
            state: true,
            country: true,
            latitude: true,
            longitude: true,
            mapboxPlaceId: true,
            boundaryGeoJson: true,
            neighborhood: true,
            postalCode: true,
            companyId: true,
          },
        },
        features: {
          orderBy: {
            label: "asc",
          },
          select: {
            label: true,
            value: true,
          },
        },
        units: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
            unitCode: true,
            title: true,
            status: true,
            price: true,
            bedrooms: true,
            bathrooms: true,
            sizeSqm: true,
            floor: true,
            block: true,
          },
        },
        media: {
          orderBy: {
            sortOrder: "asc",
          },
          select: {
            id: true,
            title: true,
            url: true,
            mimeType: true,
            sortOrder: true,
            isPrimary: true,
            visibility: true,
          },
        },
        paymentPlans: {
          orderBy: [{ createdAt: "asc" }],
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
      },
    } as Parameters<typeof prisma.property.findMany>[0],
  )) as Array<{
    id: string;
    title: string;
    slug: string;
    shortDescription: string;
    description: string;
    propertyType: string;
    status: string;
    isFeatured: boolean;
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
    brochureDocumentId: string | null;
    videoUrl: string | null;
    offerEndsAt: Date | null;
    countdownLabel: string | null;
    countdownEnabled: boolean;
    locationSummary: string | null;
    landmarks: unknown;
    hasPaymentPlan: boolean;
    lastVerifiedAt: Date | null;
    verificationStatus: "VERIFIED" | "STALE" | "UNVERIFIED" | "HIDDEN";
    verificationDueAt: Date;
    isPubliclyVisible: boolean;
    autoHiddenAt: Date | null;
    verificationNotes: string | null;
    wishlistDurationDays: number | null;
    wishlistReminderEnabled: boolean;
    location: {
      addressLine1: string | null;
      formattedAddress: string | null;
      city: string;
      state: string;
      country: string;
      latitude: Decimalish | null;
      longitude: Decimalish | null;
      mapboxPlaceId: string | null;
      boundaryGeoJson: unknown;
      neighborhood: string | null;
      postalCode: string | null;
      companyId: string;
    } | null;
    features: Array<{ label: string; value: string | null }>;
    units: Array<{
      id: string;
      unitCode: string;
      title: string;
      status: string;
      price: Decimalish;
      bedrooms: number | null;
      bathrooms: number | null;
      sizeSqm: Decimalish | null;
      floor: number | null;
      block: string | null;
    }>;
    media: Array<{
      id: string;
      title: string | null;
      url: string;
      mimeType: string | null;
      sortOrder: number;
      isPrimary: boolean;
      visibility: string;
    }>;
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
  }>;

  return properties
    .filter((property) => property.location?.companyId === context.companyId)
    .map((property) => {
      const verification = buildPropertyVerificationPresentation({
        lastVerifiedAt: property.lastVerifiedAt,
        verificationStatus: property.verificationStatus,
        verificationDueAt: property.verificationDueAt,
        isPubliclyVisible: property.isPubliclyVisible,
        autoHiddenAt: property.autoHiddenAt,
      });

      return {
        id: property.id,
        title: property.title,
        slug: property.slug,
        shortDescription: property.shortDescription,
        description: property.description,
        propertyType: property.propertyType,
        status: property.status,
        isFeatured: property.isFeatured,
        priceFrom: decimalToNumber(property.priceFrom) ?? 0,
        priceTo: decimalToNumber(property.priceTo),
        currency: property.currency,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        parkingSpaces: property.parkingSpaces,
        sizeSqm: decimalToNumber(property.sizeSqm),
        landSizeSqm: decimalToNumber(property.landSizeSqm),
        numberOfPlots: decimalToNumber(property.numberOfPlots),
        landSaleUnit: property.landSaleUnit as AdminPropertyManagementRecord["landSaleUnit"],
        hectares: decimalToNumber(property.hectares),
        acres: decimalToNumber(property.acres),
        plotOptions: normalizePlotOptions(property.plotOptions),
        brochureDocumentId: property.brochureDocumentId,
        videoUrl: property.videoUrl,
        offerEndsAt: property.offerEndsAt?.toISOString() ?? null,
        countdownLabel: property.countdownLabel,
        countdownEnabled: property.countdownEnabled,
        locationSummary: property.locationSummary,
        landmarks: Array.isArray(property.landmarks)
          ? property.landmarks.filter((item): item is string => typeof item === "string")
          : [],
        hasPaymentPlan: property.hasPaymentPlan,
        lastVerifiedAt: property.lastVerifiedAt?.toISOString() ?? null,
        verificationStatus: verification.status,
        verificationDueAt: verification.verificationDueAt.toISOString(),
        isPubliclyVisible: verification.isPubliclyVisible,
        autoHiddenAt: verification.autoHiddenAt?.toISOString() ?? null,
        verificationNotes: property.verificationNotes,
        verification: {
          label: verification.label,
          detail: verification.detail,
          tone: verification.tone,
        },
        wishlistDurationDays: property.wishlistDurationDays,
        wishlistReminderEnabled: property.wishlistReminderEnabled,
        location: {
          addressLine1: property.location?.addressLine1 ?? null,
          formattedAddress: property.location?.formattedAddress ?? null,
          city: property.location?.city ?? "",
          state: property.location?.state ?? "",
          country: property.location?.country ?? "Nigeria",
          latitude: decimalToNumber(property.location?.latitude),
          longitude: decimalToNumber(property.location?.longitude),
          mapboxPlaceId: property.location?.mapboxPlaceId ?? null,
          boundaryGeoJson: property.location?.boundaryGeoJson ?? null,
          neighborhood: property.location?.neighborhood ?? null,
          postalCode: property.location?.postalCode ?? null,
        },
        features: property.features,
        units: property.units.map((unit) => ({
          ...unit,
          price: decimalToNumber(unit.price) ?? 0,
          sizeSqm: decimalToNumber(unit.sizeSqm),
        })),
        media: property.media,
        paymentPlans: property.paymentPlans.map((plan) => ({
          id: plan.id,
          propertyUnitId: plan.propertyUnitId,
          title: plan.title,
          kind: plan.kind,
          description: plan.description,
          scheduleDescription: plan.scheduleDescription,
          durationMonths: plan.durationMonths,
          installmentCount: plan.installmentCount,
          depositPercent: decimalToNumber(plan.depositPercent),
          downPaymentAmount: decimalToNumber(plan.downPaymentAmount),
          isActive: plan.isActive,
          installments: plan.installments.map((installment) => ({
            id: installment.id,
            title: installment.title,
            amount: decimalToNumber(installment.amount) ?? 0,
            dueInDays: installment.dueInDays,
            scheduleLabel: installment.scheduleLabel,
            sortOrder: installment.sortOrder,
          })),
        })),
      };
    });
}

export async function getAvailableBrochureDocuments(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return [] as Array<{ id: string; fileName: string }>;
  }

  return (await findManyForTenant(
    prisma.document as ScopedFindManyDelegate,
    context,
    {
      where: {
        documentType: "BROCHURE",
        visibility: "PUBLIC",
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        fileName: true,
      },
    } as Parameters<typeof prisma.document.findMany>[0],
  )) as Array<{ id: string; fileName: string }>;
}

export async function getPropertyForAdminEdit(
  context: TenantContext,
  propertyId: string,
) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return null;
  }

  const list = await getAdminPropertyManagementList(context);
  return list.find((property) => property.id === propertyId) ?? null;
}
