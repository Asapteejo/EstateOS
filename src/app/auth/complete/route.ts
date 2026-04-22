import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/db/prisma";
import {
  TENANT_HINT_COOKIE,
  buildAuthRedirect,
  buildServerDomainConfig,
  defaultReturnPathForEntry,
  sanitizeReturnPath,
  sanitizeTenantHost,
  sanitizeTenantSlug,
} from "@/lib/domains";
import { env, featureFlags } from "@/lib/env";
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const entry = url.searchParams.get("entry");
  const fallbackPath = defaultReturnPathForEntry(
    entry === "admin" || entry === "buyer" || entry === "purchase" || entry === "continue" || entry === "superadmin"
      ? entry
      : undefined,
  );
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
        entry:
          entry === "admin" || entry === "buyer" || entry === "purchase" || entry === "continue" || entry === "superadmin"
            ? entry
            : "buyer",
      }),
    );
  }

  let resolvedTenantSlug = tenantSlug;

  if (!resolvedTenantSlug && (tenantHost || tenantSlug)) {
    const company = await resolveCompanyForTenantHint({
      companySlug: tenantSlug,
      host: tenantHost,
    });

    resolvedTenantSlug = company?.slug ?? resolvedTenantSlug;
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

  const response = NextResponse.redirect(new URL(returnTo, env.PORTAL_BASE_URL));

  if (resolvedTenantSlug) {
    response.cookies.set(
      TENANT_HINT_COOKIE,
      resolvedTenantSlug,
      buildTenantHintCookieOptions(),
    );
  }

  return response;
}
