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

const isPortalRoute = createRouteMatcher(["/portal(.*)"]);
const isAppRoute = createRouteMatcher(["/app(.*)"]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isSuperadminRoute = createRouteMatcher(["/superadmin(.*)"]);
const isSignInRoute = createRouteMatcher(["/sign-in(.*)"]);
const isSignUpRoute = createRouteMatcher(["/sign-up(.*)"]);

async function handleProxyRequest(
  req: NextRequest,
  protect?: () => Promise<unknown>,
) {
  const runtimeConfig = buildServerDomainConfig(env);
  const isAuthSurface =
    isPortalRoute(req) ||
    isAppRoute(req) ||
    isAdminRoute(req) ||
    isSuperadminRoute(req) ||
    isSignInRoute(req) ||
    isSignUpRoute(req);

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

    return NextResponse.next();
  }

  if (isPortalRoute(req) || isAdminRoute(req) || isSuperadminRoute(req)) {
    await protect?.();
  }

  return NextResponse.next();
}

const proxy = featureFlags.hasClerk
  ? clerkMiddleware(async (auth, req) => handleProxyRequest(req, () => auth.protect()))
  : handleProxyRequest;

export default proxy;

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/"],
};
