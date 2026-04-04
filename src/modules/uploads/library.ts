import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { buildPublicAssetUrl } from "@/lib/uploads/assets";
import type { TenantContext } from "@/lib/tenancy/context";
import { findManyForTenant } from "@/lib/tenancy/db";
import { getTenantBrandingState } from "@/modules/branding/service";
import type { UploadPurpose } from "@/modules/uploads/config";

type ScopedFindManyDelegate = { findMany: (args?: unknown) => Promise<unknown> };

export type MediaLibraryAsset = {
  id: string;
  fileName: string;
  purpose: UploadPurpose;
  kind: "image" | "document";
  visibility: "PUBLIC" | "PRIVATE";
  url: string | null;
  storageKey: string | null;
  documentId: string | null;
  createdAt: string;
  source: "branding" | "staff" | "property" | "document";
};

export type MediaLibraryFilters = {
  query?: string;
  visibility?: "ALL" | "PUBLIC" | "PRIVATE";
  kind?: "ALL" | "image" | "document";
  purpose?: UploadPurpose | "ALL";
};

function normalizePurpose(value: unknown): UploadPurpose | null {
  return typeof value === "string" &&
    ["BRAND_LOGO", "BRAND_FAVICON", "BRAND_HERO", "STAFF_PHOTO", "RESUME", "PROPERTY_MEDIA", "BROCHURE", "KYC_DOCUMENT"].includes(value)
    ? (value as UploadPurpose)
    : null;
}

export async function getTenantMediaLibrary(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return [] as MediaLibraryAsset[];
  }

  const [brandingState, teamRows, propertyRows, documentRows] = await Promise.all([
    getTenantBrandingState(context),
    findManyForTenant(prisma.teamMember as ScopedFindManyDelegate, context, {
      where: {
        avatarUrl: { not: null },
      },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    } as Parameters<typeof prisma.teamMember.findMany>[0]),
    findManyForTenant(prisma.property as ScopedFindManyDelegate, context, {
      select: {
        id: true,
        title: true,
        media: {
          select: {
            id: true,
            title: true,
            url: true,
            visibility: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    } as Parameters<typeof prisma.property.findMany>[0]),
    findManyForTenant(prisma.document as ScopedFindManyDelegate, context, {
      select: {
        id: true,
        fileName: true,
        storageKey: true,
        visibility: true,
        documentType: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 120,
    } as Parameters<typeof prisma.document.findMany>[0]),
  ]);

  const assets: MediaLibraryAsset[] = [];

  const brandAssets = [
    ["brand-logo", brandingState.draft.logoUrl, "BRAND_LOGO", "Logo"],
    ["brand-favicon", brandingState.draft.faviconUrl, "BRAND_FAVICON", "Favicon"],
    ["brand-hero", brandingState.draft.heroImageUrl, "BRAND_HERO", "Hero image"],
  ] as const;

  for (const [id, url, purpose, fileName] of brandAssets) {
    if (!url) continue;
    assets.push({
      id,
      fileName,
      purpose,
      kind: "image",
      visibility: "PUBLIC",
      url,
      storageKey: null,
      documentId: null,
      createdAt: new Date().toISOString(),
      source: "branding",
    });
  }

  for (const row of teamRows as Array<{ id: string; fullName: string; avatarUrl: string | null; updatedAt: Date }>) {
    if (!row.avatarUrl) continue;
    assets.push({
      id: `staff-${row.id}`,
      fileName: `${row.fullName} profile image`,
      purpose: "STAFF_PHOTO",
      kind: "image",
      visibility: "PUBLIC",
      url: row.avatarUrl,
      storageKey: null,
      documentId: null,
      createdAt: row.updatedAt.toISOString(),
      source: "staff",
    });
  }

  for (const property of propertyRows as Array<{ id: string; title: string; media: Array<{ id: string; title: string | null; url: string; visibility: string; createdAt: Date }> }>) {
    for (const media of property.media) {
      assets.push({
        id: `property-media-${media.id}`,
        fileName: media.title || `${property.title} media`,
        purpose: "PROPERTY_MEDIA",
        kind: "image",
        visibility: media.visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC",
        url: media.url,
        storageKey: null,
        documentId: null,
        createdAt: media.createdAt.toISOString(),
        source: "property",
      });
    }
  }

  for (const document of documentRows as Array<{ id: string; fileName: string; storageKey: string; visibility: "PUBLIC" | "PRIVATE"; documentType: string; metadata: unknown; createdAt: Date }>) {
    const metadataPurpose = document.metadata && typeof document.metadata === "object" && !Array.isArray(document.metadata)
      ? normalizePurpose((document.metadata as Record<string, unknown>).purpose)
      : null;
    const purpose =
      metadataPurpose ??
      (document.documentType === "BROCHURE" ? "BROCHURE" : document.documentType === "KYC_ID" || document.documentType === "KYC_PROOF_OF_ADDRESS" || document.documentType === "PASSPORT_PHOTO" ? "KYC_DOCUMENT" : "RESUME");
    assets.push({
      id: `document-${document.id}`,
      fileName: document.fileName,
      purpose,
      kind: "document",
      visibility: document.visibility,
      url: document.visibility === "PUBLIC" ? buildPublicAssetUrl(document.storageKey) : null,
      storageKey: document.storageKey,
      documentId: document.id,
      createdAt: document.createdAt.toISOString(),
      source: "document",
    });
  }

  return assets.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function filterMediaLibraryAssets(
  assets: MediaLibraryAsset[],
  filters: MediaLibraryFilters,
) {
  const query = filters.query?.trim().toLowerCase() ?? "";

  return assets.filter((asset) => {
    if (filters.purpose && filters.purpose !== "ALL" && asset.purpose !== filters.purpose) {
      return false;
    }

    if (filters.visibility && filters.visibility !== "ALL" && asset.visibility !== filters.visibility) {
      return false;
    }

    if (filters.kind && filters.kind !== "ALL" && asset.kind !== filters.kind) {
      return false;
    }

    if (!query) {
      return true;
    }

    return `${asset.fileName} ${asset.purpose} ${asset.source}`.toLowerCase().includes(query);
  });
}
