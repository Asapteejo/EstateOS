import type { AppRole } from "@prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { env, featureFlags } from "@/lib/env";

export type TenantContext = {
  userId: string | null;
  companyId: string | null;
  companySlug: string | null;
  branchId: string | null;
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
      };
    }

    return null;
  }

  if (input.companyId) {
    return prisma.company.findUnique({
      where: { id: input.companyId },
      select: { id: true, slug: true },
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
      select: { id: true, slug: true },
    });
  }

  if (input.host) {
    const normalizedHost = input.host.split(":")[0];
    return prisma.company.findFirst({
      where: {
        customDomain: normalizedHost,
      },
      select: { id: true, slug: true },
    });
  }

  return null;
}

function getHostResolution(host: string | null) {
  if (!host) {
    return {
      companySlug: null,
      resolutionSource: "none" as const,
    };
  }

  const normalizedHost = host.split(":")[0];
  const parts = normalizedHost.split(".");

  if (parts.length > 2) {
    return {
      companySlug: parts[0] || null,
      resolutionSource: "subdomain" as const,
    };
  }

  return {
    companySlug: null,
    resolutionSource: "domain" as const,
  };
}

export async function resolveTenantContext(
  area: "marketing" | "portal" | "admin" = "marketing",
): Promise<TenantContext> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const hostResolution = getHostResolution(host);
  const session = await getAppSession(area);
  const fallbackSlug = env.DEFAULT_COMPANY_SLUG ?? (!featureFlags.isProduction ? "acme-realty" : undefined);

  const resolvedCompany = await lookupCompany({
    companyId: session?.companyId,
    companySlug: hostResolution.companySlug ?? session?.companySlug ?? fallbackSlug ?? null,
    host,
  });

  if (!session) {
    return {
      userId: null,
      companyId: resolvedCompany?.id ?? null,
      companySlug: resolvedCompany?.slug ?? hostResolution.companySlug ?? fallbackSlug ?? null,
      branchId: null,
      roles: [],
      isSuperAdmin: false,
      host,
      resolutionSource: hostResolution.companySlug
        ? hostResolution.resolutionSource
        : "none",
    };
  }

  return {
    userId: session.userId,
    companyId: session.roles.includes("SUPER_ADMIN")
      ? session.companyId ?? resolvedCompany?.id ?? null
      : resolvedCompany?.id ?? session.companyId,
    companySlug:
      hostResolution.companySlug ??
      resolvedCompany?.slug ??
      session.companySlug ??
      fallbackSlug ??
      null,
    branchId: session.branchId,
    roles: session.roles,
    isSuperAdmin: session.roles.includes("SUPER_ADMIN"),
    host,
    resolutionSource: hostResolution.companySlug
      ? hostResolution.resolutionSource
      : "session",
  };
}

export async function requireTenantContext(
  area: "portal" | "admin" | "marketing" = "portal",
  options?: {
    redirectOnMissingAuth?: boolean;
  },
) {
  const context = await resolveTenantContext(area);

  if (!context.userId) {
    if (options?.redirectOnMissingAuth === false) {
      throw new Error("Authentication required.");
    }

    redirect("/sign-in");
  }

  if (!context.isSuperAdmin && !context.companyId) {
    throw new Error("Tenant context is required for non-super-admin users.");
  }

  return context;
}

export async function requirePublicTenantContext() {
  const context = await resolveTenantContext("marketing");

  if (!context.companyId) {
    throw new Error("Unable to resolve tenant for public request.");
  }

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
