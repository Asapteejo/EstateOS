import { Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { buildSafeErrorLogContext, logError } from "@/lib/ops/logger";
import type { TenantContext } from "@/lib/tenancy/context";
import { rejectUnsafeCompanyIdInput } from "@/lib/tenancy/db";
import { buildPublicAssetUrl } from "@/lib/uploads/assets";
import type { BrandingConfigInput } from "@/lib/validations/branding";
import {
  buildTenantThemeStyles,
  defaultTenantBranding,
  getBrandingPublishIssues,
  normalizeTenantBrandingConfig,
  resolveBrandingState,
  type TenantBrandingConfig,
} from "@/modules/branding/theme";

export type TenantBrandingPresentation = {
  companyName: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  foregroundColor: string;
  mutedColor: string;
  cardColor: string;
  borderColor: string;
  cssVariables: Record<string, string>;
  branding: TenantBrandingConfig;
};

export function resolveTenantBrandAssetUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  if (/^(https?:|data:|blob:)/i.test(trimmed) || trimmed.startsWith("/")) {
    return trimmed;
  }

  return buildPublicAssetUrl(trimmed.replace(/^\/+/, ""));
}

export function resolveTenantBrandingAssetUrls(config: TenantBrandingConfig): TenantBrandingConfig {
  return {
    ...config,
    logoUrl: resolveTenantBrandAssetUrl(config.logoUrl),
    faviconUrl: resolveTenantBrandAssetUrl(config.faviconUrl),
    heroImageUrl: resolveTenantBrandAssetUrl(config.heroImageUrl),
  };
}

function buildFallbackBranding(input?: {
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
}) {
  return resolveTenantBrandingAssetUrls(normalizeTenantBrandingConfig({
    ...defaultTenantBranding,
    logoUrl: input?.logoUrl ?? defaultTenantBranding.logoUrl,
    primaryColor: input?.primaryColor ?? defaultTenantBranding.primaryColor,
    secondaryColor: input?.primaryColor ?? defaultTenantBranding.secondaryColor,
    accentColor: input?.accentColor ?? defaultTenantBranding.accentColor,
  }));
}

export function resolveTenantBrandingPresentation(input: {
  companyName?: string | null;
  companySlug?: string | null;
  branding?: Partial<TenantBrandingConfig> | null;
  fallback?: {
    logoUrl?: string | null;
    primaryColor?: string | null;
    accentColor?: string | null;
  } | null;
  surface?: "public" | "app";
}): TenantBrandingPresentation {
  const fallbackName = input.companySlug
    ? input.companySlug.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Tenant Company";
  const fallback = buildFallbackBranding(input.fallback ?? undefined);
  const branding = resolveTenantBrandingAssetUrls(normalizeTenantBrandingConfig({
    ...fallback,
    ...(input.branding ?? {}),
  }));
  const theme = buildTenantThemeStyles(branding, input.surface ?? "app");
  const cssVariables = Object.fromEntries(
    Object.entries(theme.style).filter(([key, value]) => key.startsWith("--") && typeof value === "string"),
  ) as Record<string, string>;

  return {
    companyName: input.companyName?.trim() || fallbackName,
    logoUrl: branding.logoUrl,
    primaryColor: branding.primaryColor,
    accentColor: branding.accentColor,
    backgroundColor: branding.backgroundColor,
    foregroundColor: theme.meta.headingColor,
    mutedColor: theme.meta.mutedColor,
    cardColor: branding.surfaceColor,
    borderColor: cssVariables["--tenant-border"] ?? "rgba(15, 23, 42, 0.08)",
    cssVariables,
    branding,
  };
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

  const state = resolveBrandingState({
    draft: company?.siteSetting?.draftBrandingConfig as Partial<TenantBrandingConfig> | null | undefined,
    published: company?.siteSetting?.publishedBrandingConfig as Partial<TenantBrandingConfig> | null | undefined,
    fallback,
    publishedAt: company?.siteSetting?.brandingPublishedAt ?? null,
  });

  return {
    ...state,
    draft: resolveTenantBrandingAssetUrls(state.draft),
    published: resolveTenantBrandingAssetUrls(state.published),
  };
}

export async function getPublishedTenantBranding(context: TenantContext) {
  try {
    const state = await getTenantBrandingState(context);
    return state.published;
  } catch (error) {
    logError("Published tenant branding lookup failed; using default branding.", {
      route: "public-marketing",
      companyId: context.companyId,
      ...buildSafeErrorLogContext(error),
    });
    return buildFallbackBranding();
  }
}

async function loadTenantPresentation(context: TenantContext) {
  const fallbackName = context.companySlug
    ? context.companySlug.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Tenant Company";

  if (!featureFlags.hasDatabase || !context.companyId) {
    const presentation = resolveTenantBrandingPresentation({
      companyName: fallbackName,
      companySlug: context.companySlug,
      branding: defaultTenantBranding,
    });
    return {
      companyName: presentation.companyName,
      branding: presentation.branding,
    };
  }

  const company = await prisma.company.findUnique({
    where: { id: context.companyId },
    select: {
      name: true,
      logoUrl: true,
      primaryColor: true,
      accentColor: true,
      siteSetting: {
        select: {
          companyName: true,
          publishedBrandingConfig: true,
        },
      },
    },
  });

  const presentation = resolveTenantBrandingPresentation({
    companyName: company?.siteSetting?.companyName ?? company?.name ?? fallbackName,
    companySlug: context.companySlug,
    branding: company?.siteSetting?.publishedBrandingConfig as Partial<TenantBrandingConfig> | null | undefined,
    fallback: {
      logoUrl: company?.logoUrl,
      primaryColor: company?.primaryColor,
      accentColor: company?.accentColor,
    },
  });

  return {
    companyName: presentation.companyName,
    branding: presentation.branding,
  };
}

export async function getTenantPresentation(context: TenantContext) {
  try {
    return await loadTenantPresentation(context);
  } catch (error) {
    logError("Tenant presentation lookup failed; using default branding.", {
      route: "authenticated-shell",
      companyIdPresent: Boolean(context.companyId),
      ...buildSafeErrorLogContext(error),
    });
    const presentation = resolveTenantBrandingPresentation({
      companySlug: context.companySlug,
      branding: defaultTenantBranding,
    });
    return {
      companyName: presentation.companyName,
      branding: presentation.branding,
    };
  }
}

export async function getPublicTenantPresentation(context: TenantContext) {
  try {
    return await getTenantPresentation(context);
  } catch (error) {
    logError("Public tenant presentation lookup failed; using default branding.", {
      route: "public-marketing",
      companyId: context.companyId,
      ...buildSafeErrorLogContext(error),
    });
    const presentation = resolveTenantBrandingPresentation({
      companySlug: context.companySlug,
      branding: defaultTenantBranding,
      surface: "public",
    });
    return {
      companyName: presentation.companyName,
      branding: presentation.branding,
    };
  }
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
