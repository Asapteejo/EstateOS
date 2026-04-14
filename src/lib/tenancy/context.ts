import type { AppRole } from "@prisma/client";
import { headers } from "next/headers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { env, featureFlags } from "@/lib/env";
import { logInfo } from "@/lib/ops/logger";
import {
  TENANT_HINT_COOKIE,
  buildAuthRedirect,
  buildServerDomainConfig,
  normalizeHost,
  resolveTenantSubdomainFromHost,
  sanitizeTenantSlug,
  shouldAllowDefaultTenantFallback,
} from "@/lib/domains";

export type TenantContext = {
  userId: string | null;
  companyId: string | null;
  companySlug: string | null;
  branchId: string | null;
  companyStatus?: "ACTIVE" | "SUSPENDED" | "DISABLED" | null;
  companySuspendedAt?: Date | null;
  companySuspensionReason?: string | null;
  roles: AppRole[];
  isSuperAdmin: boolean;
  host: string | null;
  resolutionSource: "domain" | "subdomain" | "session" | "none";
};

async function lookupCompany(
  input: {
    companyId?: string | null;
    companySlug?: string | null;
    host?: string | null;
  },
) {
  if (!featureFlags.hasDatabase) {
    if (
      input.companyId === "demo-company-acme" ||
      input.companySlug === "acme-realty" ||
      env.DEFAULT_COMPANY_SLUG === "acme-realty"
    ) {
      return {
        id: "demo-company-acme",
        slug: "acme-realty",
        status: "ACTIVE" as const,
        suspendedAt: null,
        suspensionReason: null,
      };
    }

    return null;
  }

  if (input.companyId) {
    return prisma.company.findUnique({
      where: { id: input.companyId },
      select: { id: true, slug: true, status: true, suspendedAt: true, suspensionReason: true },
    });
  }

  if (input.companySlug) {
    return prisma.company.findFirst({
      where: {
        OR: [
          { slug: input.companySlug },
          { subdomain: input.companySlug },
        ],
      },
      select: { id: true, slug: true, status: true, suspendedAt: true, suspensionReason: true },
    });
  }

  if (input.host) {
    const normalizedHost = input.host.split(":")[0];
    return prisma.company.findFirst({
      where: {
        customDomain: normalizedHost,
      },
      select: { id: true, slug: true, status: true, suspendedAt: true, suspensionReason: true },
    });
  }

  return null;
}

export async function resolveCompanyForTenantHint(input: {
  companySlug?: string | null;
  host?: string | null;
}) {
  return lookupCompany({
    companySlug: sanitizeTenantSlug(input.companySlug),
    host: normalizeHost(input.host),
  });
}

function getHostResolution(host: string | null) {
  const runtimeConfig = buildServerDomainConfig(env);
  const companySlug = resolveTenantSubdomainFromHost(host, runtimeConfig);

  if (!host || !companySlug) {
    return {
      companySlug: null,
      resolutionSource: host ? ("domain" as const) : ("none" as const),
    };
  }

  return {
    companySlug,
    resolutionSource: "subdomain" as const,
  };
}

export async function resolveTenantContext(
  area: "marketing" | "portal" | "admin" | "superadmin" = "marketing",
): Promise<TenantContext> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const cookieStore = await cookies();
  const tenantHintSlug = sanitizeTenantSlug(cookieStore.get(TENANT_HINT_COOKIE)?.value ?? null);
  const hostResolution = getHostResolution(host);
  const session = await getAppSession(area);
  const runtimeConfig = buildServerDomainConfig(env);
  const fallbackSlug = shouldAllowDefaultTenantFallback(host, runtimeConfig)
    ? env.DEFAULT_COMPANY_SLUG ?? (!featureFlags.isProduction ? "acme-realty" : undefined)
    : undefined;

  const hostHintCompany = hostResolution.companySlug
    ? await lookupCompany({
        companySlug: hostResolution.companySlug,
        host,
      })
    : normalizeHost(host) && !shouldAllowDefaultTenantFallback(host, runtimeConfig)
      ? await lookupCompany({
          host,
        })
      : null;

  const hintedCompany =
    hostHintCompany ??
    (tenantHintSlug
      ? await lookupCompany({
          companySlug: tenantHintSlug,
        })
      : null);

  const sessionCompanyById = session?.companyId
    ? await lookupCompany({
        companyId: session.companyId,
      })
    : null;

  const sessionCompany =
    sessionCompanyById ??
    (session?.companySlug
      ? await lookupCompany({
          companySlug: session.companySlug,
        })
      : null);

  const fallbackCompany = fallbackSlug
    ? await lookupCompany({
        companySlug: fallbackSlug,
      })
    : null;

  const resolvedCompany =
    area === "marketing"
      ? hostHintCompany
      : sessionCompany ?? hintedCompany ?? fallbackCompany;

  if (!featureFlags.isProduction && area === "marketing") {
    logInfo("Marketing tenant resolution.", {
      host,
      hostHintCompanySlug: hostHintCompany?.slug ?? null,
      hostResolutionSlug: hostResolution.companySlug,
      sessionCompanySlug: sessionCompany?.slug ?? null,
      tenantHintSlug,
      fallbackSlug: fallbackSlug ?? null,
      resolvedCompanyId: resolvedCompany?.id ?? null,
      resolvedCompanySlug: resolvedCompany?.slug ?? null,
      fallbackToPlatform: !resolvedCompany,
      fallbackReason:
        hostResolution.companySlug && !hostHintCompany
          ? "tenant-host-detected-but-no-company-matched-slug"
          : !resolvedCompany
            ? "no-tenant-host-match"
            : null,
    });
  }

  if (!session) {
    return {
      userId: null,
      companyId: resolvedCompany?.id ?? null,
      companySlug:
        resolvedCompany?.slug ??
        (area === "marketing" ? hostResolution.companySlug : hostResolution.companySlug ?? tenantHintSlug ?? fallbackSlug) ??
        null,
      branchId: null,
      companyStatus: resolvedCompany?.status ?? null,
      companySuspendedAt: resolvedCompany?.suspendedAt ?? null,
      companySuspensionReason: resolvedCompany?.suspensionReason ?? null,
      roles: [],
      isSuperAdmin: false,
      host,
      resolutionSource:
        area === "marketing"
          ? hostHintCompany
            ? hostResolution.companySlug
              ? hostResolution.resolutionSource
              : "domain"
            : "none"
          : hostResolution.companySlug
            ? hostResolution.resolutionSource
            : tenantHintSlug
              ? "session"
              : "none",
    };
  }

  return {
    userId: session.userId,
    companyId: session.roles.includes("SUPER_ADMIN")
      ? session.companyId ?? resolvedCompany?.id ?? null
      : sessionCompany?.id ?? resolvedCompany?.id ?? session.companyId,
    companySlug:
      (area === "marketing"
        ? hostHintCompany?.slug ?? hostResolution.companySlug
        : sessionCompany?.slug ?? hintedCompany?.slug) ??
      resolvedCompany?.slug ??
      session.companySlug ??
      fallbackSlug ??
      null,
    branchId: session.branchId,
    companyStatus: resolvedCompany?.status ?? sessionCompany?.status ?? null,
    companySuspendedAt: resolvedCompany?.suspendedAt ?? sessionCompany?.suspendedAt ?? null,
    companySuspensionReason:
      resolvedCompany?.suspensionReason ?? sessionCompany?.suspensionReason ?? null,
    roles: session.roles,
    isSuperAdmin: session.roles.includes("SUPER_ADMIN"),
    host,
    resolutionSource:
      area === "marketing"
        ? hostHintCompany
          ? hostResolution.companySlug
            ? hostResolution.resolutionSource
            : "domain"
          : "none"
        : hostResolution.companySlug
          ? hostResolution.resolutionSource
          : tenantHintSlug
            ? "session"
            : "session",
  };
}

export async function requireTenantContext(
  area: "portal" | "admin" | "marketing" | "superadmin" = "portal",
  options?: {
    redirectOnMissingAuth?: boolean;
  },
) {
  const context = await resolveTenantContext(area);

  if (!context.userId) {
    if (options?.redirectOnMissingAuth === false) {
      throw new Error("Authentication required.");
    }
    redirect(
      buildAuthRedirect(buildServerDomainConfig(env), {
        returnTo: area === "admin" ? "/admin" : area === "superadmin" ? "/superadmin" : "/portal",
        tenantSlug: context.companySlug,
        tenantHost: context.host,
        entry: area === "admin" ? "admin" : area === "superadmin" ? "superadmin" : "buyer",
      }),
    );
  }

  if (!context.isSuperAdmin && !context.companyId) {
    throw new Error("Tenant context is required for non-super-admin users.");
  }

  if (
    !context.isSuperAdmin &&
    (area === "portal" || area === "admin") &&
    context.companyStatus &&
    context.companyStatus !== "ACTIVE"
  ) {
    const accessPath =
      context.companyStatus === "SUSPENDED"
        ? `/app/access?status=suspended${
            context.companySuspensionReason
              ? `&reason=${encodeURIComponent(context.companySuspensionReason)}`
              : ""
          }`
        : "/app/access?status=disabled";

    if (options?.redirectOnMissingAuth === false) {
      throw new Error(
        context.companyStatus === "SUSPENDED"
          ? "Company workspace is suspended."
          : "Company workspace is unavailable.",
      );
    }

    redirect(accessPath);
  }

  return context;
}

export async function requirePublicTenantContext() {
  const context = await resolveTenantContext("marketing");

  if (!context.companyId) {
    throw new Error("Unable to resolve tenant for public request.");
  }

  logInfo("Tenant resolved for public request.", {
    host: context.host,
    companyId: context.companyId,
    companySlug: context.companySlug,
    resolutionSource: context.resolutionSource,
  });

  return context;
}

export function assertTenantAccess(
  context: TenantContext,
  companyId?: string | null,
) {
  if (context.isSuperAdmin) {
    return true;
  }

  if (!context.companyId || !companyId || context.companyId !== companyId) {
    throw new Error("Cross-tenant access denied.");
  }

  return true;
}

export function tenantWhere<T extends Record<string, unknown>>(
  context: TenantContext,
  where: T,
) {
  if (context.isSuperAdmin || !context.companyId) {
    return where;
  }

  return {
    ...where,
    companyId: context.companyId,
  };
}
