import type { AppRole } from "@prisma/client";
import { headers } from "next/headers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAppSession, resolveTenantSessionIdentity } from "@/lib/auth/session";
import { resolveAuthenticatedSetupRedirect } from "@/lib/auth/access";
import { prisma } from "@/lib/db/prisma";
import { env, featureFlags } from "@/lib/env";
import { buildSafeErrorLogContext, logError, logInfo, logWarn } from "@/lib/ops/logger";
import {
  TENANT_HINT_COOKIE,
  buildAuthRedirect,
  buildServerDomainConfig,
  normalizeHost,
  resolveTenantSubdomainFromHost,
  sanitizeTenantSlug,
  shouldAllowDefaultTenantFallback,
} from "@/lib/domains";
import { getCustomDomainLookupCandidates } from "@/lib/domains/custom-domain";
import { selectAuthenticatedCompany } from "@/lib/tenancy/authenticated-company";

export type TenantContext = {
  userId: string | null;
  clerkUserId?: string | null;
  email?: string | null;
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
        name: "Acme Realty",
        slug: "acme-realty",
        customDomain: null,
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
      select: { id: true, name: true, slug: true, customDomain: true, status: true, suspendedAt: true, suspensionReason: true },
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
      select: { id: true, name: true, slug: true, customDomain: true, status: true, suspendedAt: true, suspensionReason: true },
    });
  }

  if (input.host) {
    const hostCandidates = getCustomDomainLookupCandidates(input.host);
    if (hostCandidates.length === 0) {
      return null;
    }

    return prisma.company.findFirst({
      where: {
        customDomain: { in: hostCandidates },
      },
      select: { id: true, name: true, slug: true, customDomain: true, status: true, suspendedAt: true, suspensionReason: true },
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
  let marketingLookupFailed = false;
  const lookupCompanyForRequest = async (input: Parameters<typeof lookupCompany>[0]) => {
    if (marketingLookupFailed && area === "marketing") {
      return null;
    }

    try {
      return await lookupCompany(input);
    } catch (error) {
      if (area !== "marketing") {
        logError("Authenticated tenant company lookup failed.", {
          route: `/${area}`,
          area,
          step: "tenant-company-lookup",
          companyIdHintPresent: Boolean(input.companyId),
          companySlugHintPresent: Boolean(input.companySlug),
          hostHintPresent: Boolean(input.host),
          ...buildSafeErrorLogContext(error),
        });
        throw error;
      }

      marketingLookupFailed = true;
      logError("Marketing tenant lookup failed; rendering platform fallback.", {
        route: "/",
        host,
        ...buildSafeErrorLogContext(error),
      });
      return null;
    }
  };
  let session;
  try {
    session = await getAppSession(area);
  } catch (error) {
    if (area !== "marketing") {
      throw error;
    }

    logError("Marketing session resolution failed; continuing without a session.", {
      route: "/",
      host,
      ...buildSafeErrorLogContext(error),
    });
    session = null;
  }
  const runtimeConfig = buildServerDomainConfig(env);
  const fallbackSlug = shouldAllowDefaultTenantFallback(host, runtimeConfig)
    ? env.DEFAULT_COMPANY_SLUG ?? (!featureFlags.isProduction ? "acme-realty" : undefined)
    : undefined;

  const customDomainHostCompany = normalizeHost(host) && !shouldAllowDefaultTenantFallback(host, runtimeConfig)
    ? await lookupCompanyForRequest({ host })
    : null;
  const subdomainHostCompany = !customDomainHostCompany && hostResolution.companySlug
    ? await lookupCompanyForRequest({
        companySlug: hostResolution.companySlug,
      })
    : null;
  const hostHintCompany = customDomainHostCompany ?? subdomainHostCompany;
  const hostHintResolutionSource = customDomainHostCompany
    ? "domain"
    : subdomainHostCompany
      ? hostResolution.resolutionSource
      : "none";

  const hintedCompany =
    hostHintCompany ??
    (tenantHintSlug
      ? await lookupCompanyForRequest({
          companySlug: tenantHintSlug,
        })
      : null);

  const sessionCompanyById = session?.companyId
    ? await lookupCompanyForRequest({
        companyId: session.companyId,
      })
    : null;

  const sessionCompany =
    sessionCompanyById ??
    (session?.companySlug
      ? await lookupCompanyForRequest({
          companySlug: session.companySlug,
        })
      : null);

  const fallbackCompany = fallbackSlug
    ? await lookupCompanyForRequest({
        companySlug: fallbackSlug,
      })
    : null;

  const resolvedCompany =
    area === "marketing"
      ? hostHintCompany
      : selectAuthenticatedCompany({
          sessionCompany,
          hintedCompany,
          fallbackCompany,
        });

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
      clerkUserId: null,
      email: null,
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
            ? hostHintResolutionSource
            : "none"
          : hostResolution.companySlug
            ? hostResolution.resolutionSource
            : tenantHintSlug
              ? "session"
              : "none",
    };
  }

  const identity = resolveTenantSessionIdentity(session);
  const context: TenantContext = {
    userId: identity.userId,
    clerkUserId: identity.clerkUserId,
    email: session.email || null,
    companyId: session.roles.includes("SUPER_ADMIN")
      ? session.companyId ?? resolvedCompany?.id ?? null
      : sessionCompany?.id ?? null,
    companySlug:
      (area === "marketing"
        ? hostHintCompany?.slug ?? hostResolution.companySlug
        : sessionCompany?.slug) ??
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
          ? hostHintResolutionSource
          : "none"
        : hostResolution.companySlug
          ? hostResolution.resolutionSource
          : tenantHintSlug
            ? "session"
            : "session",
  };
  logInfo("Resolved authenticated tenant context.", {
    area,
    step: "tenant-context-resolved",
    userIdPresent: Boolean(context.userId),
    emailPresent: Boolean(context.email),
    rolesFound: context.roles,
    companyIdResolved: Boolean(context.companyId),
    resolutionSource: context.resolutionSource,
  });
  return context;
}

export async function requireTenantContext(
  area: "portal" | "admin" | "marketing" | "superadmin" = "portal",
  options?: {
    redirectOnMissingAuth?: boolean;
  },
) {
  const context = await resolveTenantContext(area);

  if (!context.clerkUserId) {
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

  const setupRedirect = resolveAuthenticatedSetupRedirect({
    area,
    roles: context.roles,
    companyId: context.companyId,
    email: context.email ?? "",
  });
  if (setupRedirect) {
    logWarn("Authenticated tenant context requires account setup.", {
      area,
      step: "tenant-context-access-check",
      userIdPresent: Boolean(context.userId),
      emailPresent: Boolean(context.email),
      rolesFound: context.roles,
      companyIdResolved: Boolean(context.companyId),
      redirectTo: setupRedirect,
    });

    if (options?.redirectOnMissingAuth === false) {
      throw new Error("Authenticated account setup is required.");
    }

    redirect(setupRedirect);
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
  if (context.isSuperAdmin) {
    return where;
  }
  if (!context.companyId) {
    throw new Error("Tenant context is required for scoped query.");
  }

  return {
    ...where,
    companyId: context.companyId,
  };
}
