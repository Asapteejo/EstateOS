import { NextResponse } from "next/server";

import {
  DEV_SESSION_BRANCH_ID_COOKIE,
  DEV_SESSION_COMPANY_ID_COOKIE,
  DEV_SESSION_COMPANY_SLUG_COOKIE,
  DEV_SESSION_COOKIE,
  type DemoSessionRole,
} from "@/lib/auth/session";
import { buildServerDomainConfig, resolveSafeRedirectUrl } from "@/lib/domains";
import { env, featureFlags } from "@/lib/env";

const ALLOWED_ROLES = new Set<DemoSessionRole>(["buyer", "admin", "superadmin"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const role = url.searchParams.get("role");
  const redirectTo = url.searchParams.get("redirectTo") ?? "/";
  const response = NextResponse.redirect(
    resolveSafeRedirectUrl(buildServerDomainConfig(env), redirectTo, "/"),
  );

  if (!featureFlags.allowDevBypass) {
    response.cookies.delete(DEV_SESSION_COOKIE);
    response.cookies.delete(DEV_SESSION_COMPANY_ID_COOKIE);
    response.cookies.delete(DEV_SESSION_COMPANY_SLUG_COOKIE);
    response.cookies.delete(DEV_SESSION_BRANCH_ID_COOKIE);
    return response;
  }

  if (role === "clear") {
    response.cookies.delete(DEV_SESSION_COOKIE);
    response.cookies.delete(DEV_SESSION_COMPANY_ID_COOKIE);
    response.cookies.delete(DEV_SESSION_COMPANY_SLUG_COOKIE);
    response.cookies.delete(DEV_SESSION_BRANCH_ID_COOKIE);
    return response;
  }

  if (role && ALLOWED_ROLES.has(role as DemoSessionRole)) {
    response.cookies.set(DEV_SESSION_COOKIE, role, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });
  }

  return response;
}
