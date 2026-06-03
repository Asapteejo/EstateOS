import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import {
  canAccessTenantEntry,
  defaultDashboardForRoles,
  type TenantEntryIntent,
} from "@/lib/auth/access";
import { getAppSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  TENANT_HINT_COOKIE,
  buildAuthRedirect,
  buildServerDomainConfig,
  defaultReturnPathForEntry,
  resolveAuthEntryIntent,
  sanitizeReturnPath,
  sanitizeTenantHost,
  sanitizeTenantSlug,
} from "@/lib/domains";
import { env, featureFlags } from "@/lib/env";
import { captureServerEvent, captureServerException } from "@/lib/integrations/posthog";
import { resolveCompanyForTenantHint } from "@/lib/tenancy/context";
export const runtime = "nodejs";

function buildTenantHintCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: featureFlags.isProduction,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

function buildTenantAccessUrl(input: {
  baseUrl: string;
  entry: TenantEntryIntent;
  returnTo: string;
  currentDashboard: string;
  tenantSlug?: string | null;
  tenantHost?: string | null;
  tenantName?: string | null;
}) {
  const url = new URL("/auth/access", input.baseUrl);
  url.searchParams.set("entry", input.entry === "admin" ? "admin" : "buyer");
  url.searchParams.set("returnTo", input.returnTo);
  url.searchParams.set("current", input.currentDashboard);

  if (input.tenantSlug) {
    url.searchParams.set("tenant", input.tenantSlug);
  }

  if (input.tenantHost) {
    url.searchParams.set("host", input.tenantHost);
  }

  if (input.tenantName) {
    url.searchParams.set("company", input.tenantName);
  }

  return url;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const entry = url.searchParams.get("entry");
    const resolvedEntry = resolveAuthEntryIntent(entry, {
      allowSuperadmin: !featureFlags.isProduction,
    });
    const fallbackPath = defaultReturnPathForEntry(resolvedEntry);
    const returnTo = sanitizeReturnPath(url.searchParams.get("returnTo"), fallbackPath);
    const tenantSlug = sanitizeTenantSlug(url.searchParams.get("tenant"));
    const tenantHost = sanitizeTenantHost(url.searchParams.get("host"));
    const runtimeConfig = buildServerDomainConfig(env);
    const session = featureFlags.hasClerk ? await auth() : null;

    if (featureFlags.hasClerk && !session?.userId) {
      return NextResponse.redirect(
        buildAuthRedirect(runtimeConfig, {
          returnTo,
          tenantSlug,
          tenantHost,
          entry: resolvedEntry ?? "buyer",
        }),
      );
    }

    let resolvedTenantSlug = tenantSlug;
    let resolvedTenant: Awaited<ReturnType<typeof resolveCompanyForTenantHint>> = null;

    if (!resolvedTenantSlug && (tenantHost || tenantSlug)) {
      const company = await resolveCompanyForTenantHint({
        companySlug: tenantSlug,
        host: tenantHost,
      });

      resolvedTenant = company;
      resolvedTenantSlug = company?.slug ?? resolvedTenantSlug;
    }

    if (resolvedTenantSlug && !resolvedTenant) {
      resolvedTenant = await resolveCompanyForTenantHint({
        companySlug: resolvedTenantSlug,
        host: tenantHost,
      });
    }

    if (!resolvedTenantSlug && featureFlags.hasDatabase && session?.userId) {
      const user = await prisma.user.findUnique({
        where: { clerkUserId: session.userId },
        select: {
          company: {
            select: {
              slug: true,
            },
          },
        },
      });

      resolvedTenantSlug = user?.company?.slug ?? null;
    }

    const tenantEntry =
      resolvedEntry === "admin" || resolvedEntry === "buyer" || resolvedEntry === "purchase"
        ? resolvedEntry
        : null;
    if (tenantEntry && resolvedTenant) {
      const appSession = await getAppSession();
      if (!canAccessTenantEntry({
        entry: tenantEntry,
        session: appSession,
        target: { companyId: resolvedTenant.id },
      })) {
        return NextResponse.redirect(
          buildTenantAccessUrl({
            baseUrl: env.PORTAL_BASE_URL,
            entry: tenantEntry,
            returnTo,
            currentDashboard: defaultDashboardForRoles(appSession?.roles ?? []),
            tenantSlug: resolvedTenant.slug,
            tenantHost,
            tenantName: resolvedTenant.name,
          }),
        );
      }
    }

    const response = NextResponse.redirect(new URL(returnTo, env.PORTAL_BASE_URL));

    if (resolvedTenantSlug) {
      response.cookies.set(
        TENANT_HINT_COOKIE,
        resolvedTenantSlug,
        buildTenantHintCookieOptions(),
      );
    }

    await captureServerEvent(
      "auth_complete_succeeded",
      {
        entry,
        returnTo,
        tenantSlug: resolvedTenantSlug,
      },
      {
        source: "auth",
        route: "/auth/complete",
        method: "GET",
        companySlug: resolvedTenantSlug,
        userId: session?.userId ?? null,
        area: "app",
        requestId: request.headers.get("x-vercel-id"),
      },
      {
        severity: "LOW",
      },
    );

    return response;
  } catch (error) {
    await captureServerException(error, {
      source: "auth",
      route: "/auth/complete",
      method: "GET",
      area: "app",
      requestId: request.headers.get("x-vercel-id"),
      statusCode: 500,
    }, {
      severity: "HIGH",
    });
    await captureServerEvent(
      "auth_complete_failed",
      {},
      {
        source: "auth",
        route: "/auth/complete",
        method: "GET",
        area: "app",
        requestId: request.headers.get("x-vercel-id"),
      },
      {
        severity: "HIGH",
      },
    );
    throw error;
  }
}
