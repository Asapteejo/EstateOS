import { NextResponse, type NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import {
  buildAuthRedirect,
  buildServerDomainConfig,
  isKnownCentralHost,
  sanitizeReturnPath,
} from "@/lib/domains";
import { env, featureFlags } from "@/lib/env";
import { logWarn } from "@/lib/ops/logger";
import {
  buildContentSecurityPolicy,
  generateCspNonce,
  resolveMediaHost,
} from "@/lib/security/csp";

const isPortalRoute = createRouteMatcher(["/portal(.*)"]);
const isAppRoute = createRouteMatcher(["/app(.*)"]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isSuperadminRoute = createRouteMatcher(["/superadmin(.*)"]);
const isSignInRoute = createRouteMatcher(["/sign-in(.*)"]);
const isSignUpRoute = createRouteMatcher(["/sign-up(.*)"]);
const isAuthAccessRoute = createRouteMatcher(["/auth/access(.*)"]);

/**
 * Nonce-based CSP, enforced in production.
 *
 * The nonce is forwarded on the REQUEST via the `content-security-policy`
 * header — Next.js reads the nonce from there and stamps it onto its own
 * inline/bootstrap scripts and /_next chunk tags. The same policy is then set
 * on the RESPONSE so the browser enforces it. See src/lib/security/csp.ts for
 * the policy itself and the browser-generation fallback strategy.
 *
 * Dev/test skip the CSP entirely (React Fast Refresh needs eval; the old
 * report-only header never applied meaningfully there either).
 */
const cspMediaHost = resolveMediaHost(env.R2_PUBLIC_BASE_URL);

function createCspContext() {
  if (!featureFlags.isProduction) {
    return null;
  }
  const nonce = generateCspNonce();
  return {
    nonce,
    policy: buildContentSecurityPolicy({ nonce, mediaHost: cspMediaHost }),
  };
}

function applyCspResponseHeader(
  response: NextResponse,
  csp: ReturnType<typeof createCspContext>,
) {
  if (!csp) {
    return response;
  }
  response.headers.set(
    featureFlags.cspReportOnly
      ? "Content-Security-Policy-Report-Only"
      : "Content-Security-Policy",
    csp.policy,
  );
  return response;
}

async function handleProxyRequest(
  req: NextRequest,
  protect?: () => Promise<unknown>,
) {
  const runtimeConfig = buildServerDomainConfig(env);
  const requestHeaders = new Headers(req.headers);
  const csp = createCspContext();
  if (csp) {
    requestHeaders.set("x-nonce", csp.nonce);
    requestHeaders.set("content-security-policy", csp.policy);
  }
  const devTenant = req.nextUrl.searchParams.get("devTenant");
  const sanitizedDevTenant =
    featureFlags.devAccessMode && devTenant && /^[a-z0-9-]+$/.test(devTenant)
      ? devTenant
      : null;
  if (sanitizedDevTenant) {
    requestHeaders.set("x-estateos-dev-tenant", sanitizedDevTenant);
  }
  const isAuthSurface =
    isPortalRoute(req) ||
    isAppRoute(req) ||
    isAdminRoute(req) ||
    isSuperadminRoute(req) ||
    isSignInRoute(req) ||
    isSignUpRoute(req) ||
    isAuthAccessRoute(req);

  if (
    featureFlags.isProduction &&
    isAuthSurface &&
    !isKnownCentralHost(req.headers.get("host"), runtimeConfig)
  ) {
    return NextResponse.redirect(
      buildAuthRedirect(runtimeConfig, {
        returnTo: sanitizeReturnPath(
          isSignInRoute(req)
            ? req.nextUrl.searchParams.get("returnTo")
            : `${req.nextUrl.pathname}${req.nextUrl.search}`,
          isAppRoute(req)
            ? "/app/onboarding"
            : isAdminRoute(req)
              ? "/admin"
              : isSuperadminRoute(req)
                ? "/superadmin"
                : "/portal",
        ),
        tenantSlug: req.nextUrl.searchParams.get("tenant"),
        tenantHost: req.nextUrl.searchParams.get("host") ?? req.headers.get("host"),
        entry: isAppRoute(req)
          ? "admin"
          : isAdminRoute(req)
            ? "admin"
            : isSuperadminRoute(req)
              ? "superadmin"
              : "buyer",
      }),
    );
  }

  if (!featureFlags.hasClerk || !featureFlags.isProduction) {
    if (
      featureFlags.isProduction &&
      !featureFlags.hasClerk &&
      (isPortalRoute(req) || isAdminRoute(req) || isSuperadminRoute(req))
    ) {
      logWarn("Blocked authenticated route because Clerk is not configured.", {
        route: req.nextUrl.pathname,
      });
      return new NextResponse("Authentication is not configured for this deployment.", {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    if (sanitizedDevTenant) {
      response.cookies.set("estateos_dev_company_slug", sanitizedDevTenant, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 8,
      });
    }
    return applyCspResponseHeader(response, csp);
  }

  if (isPortalRoute(req) || isAdminRoute(req) || isSuperadminRoute(req)) {
    await protect?.();
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  if (sanitizedDevTenant) {
    response.cookies.set("estateos_dev_company_slug", sanitizedDevTenant, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
  }
  return applyCspResponseHeader(response, csp);
}

const proxy = featureFlags.hasClerk
  ? clerkMiddleware(async (auth, req) => handleProxyRequest(req, () => auth.protect()))
  : handleProxyRequest;

export default proxy;

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/"],
};
