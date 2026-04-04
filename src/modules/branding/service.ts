import { Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import type { TenantContext } from "@/lib/tenancy/context";
import { rejectUnsafeCompanyIdInput } from "@/lib/tenancy/db";
import type { BrandingConfigInput } from "@/lib/validations/branding";
import {
  defaultTenantBranding,
  getBrandingPublishIssues,
  normalizeTenantBrandingConfig,
  resolveBrandingState,
  type TenantBrandingConfig,
} from "@/modules/branding/theme";

function buildFallbackBranding(input?: {
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
}) {
  return normalizeTenantBrandingConfig({
    ...defaultTenantBranding,
    logoUrl: input?.logoUrl ?? defaultTenantBranding.logoUrl,
    primaryColor: input?.primaryColor ?? defaultTenantBranding.primaryColor,
    secondaryColor: input?.primaryColor ?? defaultTenantBranding.secondaryColor,
    accentColor: input?.accentColor ?? defaultTenantBranding.accentColor,
  });
}

export async function getTenantBrandingState(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return resolveBrandingState({
      published: defaultTenantBranding,
      draft: defaultTenantBranding,
      publishedAt: null,
    });
  }

  const company = await prisma.company.findUnique({
    where: { id: context.companyId },
    select: {
      logoUrl: true,
      primaryColor: true,
      accentColor: true,
      siteSetting: {
        select: {
          draftBrandingConfig: true,
          publishedBrandingConfig: true,
          brandingPublishedAt: true,
        },
      },
    },
  });

  const fallback = buildFallbackBranding({
    logoUrl: company?.logoUrl,
    primaryColor: company?.primaryColor,
    accentColor: company?.accentColor,
  });

  return resolveBrandingState({
    draft: company?.siteSetting?.draftBrandingConfig as Partial<TenantBrandingConfig> | null | undefined,
    published: company?.siteSetting?.publishedBrandingConfig as Partial<TenantBrandingConfig> | null | undefined,
    fallback,
    publishedAt: company?.siteSetting?.brandingPublishedAt ?? null,
  });
}

export async function getPublishedTenantBranding(context: TenantContext) {
  const state = await getTenantBrandingState(context);
  return state.published;
}

export async function getTenantPresentation(context: TenantContext) {
  const fallbackName = context.companySlug
    ? context.companySlug.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Tenant Company";

  if (!featureFlags.hasDatabase || !context.companyId) {
    return {
      companyName: fallbackName,
      branding: defaultTenantBranding,
    };
  }

  const company = await prisma.company.findUnique({
    where: { id: context.companyId },
    select: {
      name: true,
      siteSetting: {
        select: {
          companyName: true,
        },
      },
    },
  });

  return {
    companyName: company?.siteSetting?.companyName ?? company?.name ?? fallbackName,
    branding: await getPublishedTenantBranding(context),
  };
}

async function ensureSiteSettingsCompanyMeta(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      siteSetting: {
        select: {
          companyName: true,
        },
      },
    },
  });

  if (!company) {
    throw new Error("Tenant company not found.");
  }

  return {
    companyName: company.siteSetting?.companyName ?? company.name,
  };
}

export async function saveDraftBrandingForAdmin(
  context: TenantContext,
  rawInput: BrandingConfigInput & Record<string, unknown>,
) {
  rejectUnsafeCompanyIdInput(rawInput);

  if (!context.companyId) {
    throw new Error("Tenant context is required.");
  }

  const normalized = normalizeTenantBrandingConfig(rawInput);

  if (!featureFlags.hasDatabase) {
    return resolveBrandingState({
      draft: normalized,
      published: defaultTenantBranding,
    });
  }

  const meta = await ensureSiteSettingsCompanyMeta(context.companyId);

  await prisma.siteSettings.upsert({
    where: { companyId: context.companyId },
    update: {
      draftBrandingConfig: normalized as Prisma.InputJsonValue,
    },
    create: {
      companyId: context.companyId,
      companyName: meta.companyName,
      draftBrandingConfig: normalized as Prisma.InputJsonValue,
      publishedBrandingConfig: defaultTenantBranding as Prisma.InputJsonValue,
    },
  });

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId ?? undefined,
    action: "UPDATE",
    entityType: "TenantBrandingDraft",
    entityId: context.companyId,
    summary: "Saved draft tenant branding",
    payload: normalized as Prisma.InputJsonValue,
  });

  return getTenantBrandingState(context);
}

export async function resetDraftBrandingForAdmin(context: TenantContext) {
  if (!context.companyId) {
    throw new Error("Tenant context is required.");
  }

  if (!featureFlags.hasDatabase) {
    return resolveBrandingState({
      draft: defaultTenantBranding,
      published: defaultTenantBranding,
    });
  }

  const current = await getTenantBrandingState(context);
  const meta = await ensureSiteSettingsCompanyMeta(context.companyId);

  await prisma.siteSettings.upsert({
    where: { companyId: context.companyId },
    update: {
      draftBrandingConfig: current.published as Prisma.InputJsonValue,
    },
    create: {
      companyId: context.companyId,
      companyName: meta.companyName,
      draftBrandingConfig: current.published as Prisma.InputJsonValue,
      publishedBrandingConfig: current.published as Prisma.InputJsonValue,
    },
  });

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId ?? undefined,
    action: "UPDATE",
    entityType: "TenantBrandingDraft",
    entityId: context.companyId,
    summary: "Reset draft branding to published state",
  });

  return getTenantBrandingState(context);
}

export async function publishDraftBrandingForAdmin(context: TenantContext) {
  if (!context.companyId) {
    throw new Error("Tenant context is required.");
  }

  const current = await getTenantBrandingState(context);
  const issues = getBrandingPublishIssues(current.draft);
  if (issues.length > 0) {
    throw new Error(issues[0] ?? "Branding is not safe to publish.");
  }

  if (!featureFlags.hasDatabase) {
    return resolveBrandingState({
      draft: current.draft,
      published: current.draft,
      publishedAt: new Date().toISOString(),
    });
  }

  const meta = await ensureSiteSettingsCompanyMeta(context.companyId);

  await prisma.$transaction(async (tx) => {
    await tx.siteSettings.upsert({
      where: { companyId: context.companyId! },
      update: {
        publishedBrandingConfig: current.draft as Prisma.InputJsonValue,
        draftBrandingConfig: current.draft as Prisma.InputJsonValue,
        brandingPublishedAt: new Date(),
      },
      create: {
        companyId: context.companyId!,
        companyName: meta.companyName,
        publishedBrandingConfig: current.draft as Prisma.InputJsonValue,
        draftBrandingConfig: current.draft as Prisma.InputJsonValue,
        brandingPublishedAt: new Date(),
      },
    });

    await tx.company.update({
      where: { id: context.companyId! },
      data: {
        logoUrl: current.draft.logoUrl ?? null,
        primaryColor: current.draft.primaryColor,
        accentColor: current.draft.accentColor,
      },
    });
  });

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId ?? undefined,
    action: "UPDATE",
    entityType: "TenantBrandingPublished",
    entityId: context.companyId,
    summary: "Published tenant branding",
    payload: current.draft as Prisma.InputJsonValue,
  });

  return getTenantBrandingState(context);
}
