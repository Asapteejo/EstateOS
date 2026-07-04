import { Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { buildSafeErrorLogContext, logError } from "@/lib/ops/logger";
import type { TenantContext } from "@/lib/tenancy/context";
import type { SiteContentInput } from "@/lib/validations/site-content";
import type { StoredSiteContent } from "@/modules/cms/site-content";

/**
 * Tenant site content persistence (draft -> publish), mirroring the branding
 * service so the editing model, audit trail, and fail-safe behavior are
 * consistent across the two CMS surfaces.
 *
 * The *public render* only ever reads `getPublishedSiteContent`, which returns
 * the stored overrides (or null) and never throws — so a DB hiccup degrades to
 * the company-derived fallback copy instead of breaking the marketing site.
 */

export type TenantSiteContentState = {
  draft: StoredSiteContent;
  published: StoredSiteContent;
  publishedAt: string | null;
};

function asStored(value: Prisma.JsonValue | null | undefined): StoredSiteContent {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as StoredSiteContent;
  }
  return {};
}

async function ensureSiteSettingsCompanyName(companyId: string): Promise<string> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, siteSetting: { select: { companyName: true } } },
  });

  if (!company) {
    throw new Error("Tenant company not found.");
  }

  return company.siteSetting?.companyName ?? company.name;
}

export async function getTenantSiteContentState(
  context: TenantContext,
): Promise<TenantSiteContentState> {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return { draft: {}, published: {}, publishedAt: null };
  }

  const settings = await prisma.siteSettings.findUnique({
    where: { companyId: context.companyId },
    select: {
      draftSiteContent: true,
      publishedSiteContent: true,
      siteContentPublishedAt: true,
    },
  });

  const published = asStored(settings?.publishedSiteContent);
  // Before the tenant has edited anything, the draft mirrors the published copy.
  const draft = settings?.draftSiteContent ? asStored(settings.draftSiteContent) : published;

  return {
    draft,
    published,
    publishedAt: settings?.siteContentPublishedAt
      ? settings.siteContentPublishedAt.toISOString()
      : null,
  };
}

export type TenantPublicContact = {
  email: string | null;
  phone: string | null;
  address: string | null;
};

/**
 * Public contact details for a tenant, read from SiteSettings. Used to render the
 * tenant's own email / phone / office on the public contact page instead of
 * hardcoded placeholders. Never throws — missing fields render as omitted rows.
 */
export async function getPublicTenantContact(
  context: TenantContext,
): Promise<TenantPublicContact> {
  const empty: TenantPublicContact = { email: null, phone: null, address: null };

  if (!featureFlags.hasDatabase || !context.companyId) {
    return empty;
  }

  try {
    const settings = await prisma.siteSettings.findUnique({
      where: { companyId: context.companyId },
      select: { supportEmail: true, supportPhone: true, address: true },
    });
    return {
      email: settings?.supportEmail?.trim() || null,
      phone: settings?.supportPhone?.trim() || null,
      address: settings?.address?.trim() || null,
    };
  } catch (error) {
    logError("Public tenant contact lookup failed; omitting contact details.", {
      route: "public-marketing",
      companyId: context.companyId,
      ...buildSafeErrorLogContext(error),
    });
    return empty;
  }
}

/** Public render entry point. Never throws — returns null so callers fall back. */
export async function getPublishedSiteContent(
  context: TenantContext,
): Promise<StoredSiteContent | null> {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return null;
  }

  try {
    const settings = await prisma.siteSettings.findUnique({
      where: { companyId: context.companyId },
      select: { publishedSiteContent: true },
    });
    return settings?.publishedSiteContent ? asStored(settings.publishedSiteContent) : null;
  } catch (error) {
    logError("Published tenant site content lookup failed; using fallback copy.", {
      route: "public-marketing",
      companyId: context.companyId,
      ...buildSafeErrorLogContext(error),
    });
    return null;
  }
}

export async function saveDraftSiteContentForAdmin(
  context: TenantContext,
  input: SiteContentInput,
): Promise<TenantSiteContentState> {
  if (!context.companyId) {
    throw new Error("Tenant context is required.");
  }

  if (!featureFlags.hasDatabase) {
    return { draft: input as StoredSiteContent, published: {}, publishedAt: null };
  }

  const companyName = await ensureSiteSettingsCompanyName(context.companyId);

  await prisma.siteSettings.upsert({
    where: { companyId: context.companyId },
    update: { draftSiteContent: input as Prisma.InputJsonValue },
    create: {
      companyId: context.companyId,
      companyName,
      draftSiteContent: input as Prisma.InputJsonValue,
    },
  });

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId ?? undefined,
    action: "UPDATE",
    entityType: "TenantSiteContentDraft",
    entityId: context.companyId,
    summary: "Saved draft tenant site content",
    payload: input as Prisma.InputJsonValue,
  });

  return getTenantSiteContentState(context);
}

export async function resetDraftSiteContentForAdmin(
  context: TenantContext,
): Promise<TenantSiteContentState> {
  if (!context.companyId) {
    throw new Error("Tenant context is required.");
  }

  if (!featureFlags.hasDatabase) {
    return { draft: {}, published: {}, publishedAt: null };
  }

  const current = await getTenantSiteContentState(context);
  const companyName = await ensureSiteSettingsCompanyName(context.companyId);

  await prisma.siteSettings.upsert({
    where: { companyId: context.companyId },
    update: { draftSiteContent: current.published as Prisma.InputJsonValue },
    create: {
      companyId: context.companyId,
      companyName,
      draftSiteContent: current.published as Prisma.InputJsonValue,
    },
  });

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId ?? undefined,
    action: "UPDATE",
    entityType: "TenantSiteContentDraft",
    entityId: context.companyId,
    summary: "Reset draft site content to published state",
  });

  return getTenantSiteContentState(context);
}

export async function publishDraftSiteContentForAdmin(
  context: TenantContext,
): Promise<TenantSiteContentState> {
  if (!context.companyId) {
    throw new Error("Tenant context is required.");
  }

  const current = await getTenantSiteContentState(context);

  if (!featureFlags.hasDatabase) {
    return {
      draft: current.draft,
      published: current.draft,
      publishedAt: new Date().toISOString(),
    };
  }

  const companyName = await ensureSiteSettingsCompanyName(context.companyId);

  await prisma.siteSettings.upsert({
    where: { companyId: context.companyId },
    update: {
      publishedSiteContent: current.draft as Prisma.InputJsonValue,
      draftSiteContent: current.draft as Prisma.InputJsonValue,
      siteContentPublishedAt: new Date(),
    },
    create: {
      companyId: context.companyId,
      companyName,
      publishedSiteContent: current.draft as Prisma.InputJsonValue,
      draftSiteContent: current.draft as Prisma.InputJsonValue,
      siteContentPublishedAt: new Date(),
    },
  });

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId ?? undefined,
    action: "UPDATE",
    entityType: "TenantSiteContentPublished",
    entityId: context.companyId,
    summary: "Published tenant site content",
    payload: current.draft as Prisma.InputJsonValue,
  });

  return getTenantSiteContentState(context);
}
