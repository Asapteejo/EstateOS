import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { buildAuthRedirect, buildServerDomainConfig, isKnownCentralHost, sanitizeReturnPath } from "@/lib/domains";
import { env, featureFlags } from "@/lib/env";

const isPortalRoute = createRouteMatcher(["/portal(.*)"]);
const isAppRoute = createRouteMatcher(["/app(.*)"]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isSuperadminRoute = createRouteMatcher(["/superadmin(.*)"]);
const isSignInRoute = createRouteMatcher(["/sign-in(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const runtimeConfig = buildServerDomainConfig(env);
  const isAuthSurface =
    isPortalRoute(req) ||
    isAppRoute(req) ||
    isAdminRoute(req) ||
    isSuperadminRoute(req) ||
    isSignInRoute(req);

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
    return NextResponse.next();
  }

  if (isPortalRoute(req) || isAdminRoute(req) || isSuperadminRoute(req)) {
    await auth.protect();
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/"],
};
