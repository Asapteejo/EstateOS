import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { featureFlags } from "@/lib/env";

const isPortalRoute = createRouteMatcher(["/portal(.*)"]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isSuperadminRoute = createRouteMatcher(["/superadmin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
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
