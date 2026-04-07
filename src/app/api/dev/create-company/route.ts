import { NextResponse } from "next/server";

import {
  DEV_SESSION_BRANCH_ID_COOKIE,
  DEV_SESSION_COMPANY_ID_COOKIE,
  DEV_SESSION_COMPANY_SLUG_COOKIE,
  DEV_SESSION_COOKIE,
  buildDemoSession,
  getAppSession,
} from "@/lib/auth/session";
import { featureFlags } from "@/lib/env";
import { fail } from "@/lib/http";
import { logInfo } from "@/lib/ops/logger";
import { createSampleCompany } from "@/modules/onboarding/service";

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return fail("Development quick-create is not available outside development.", 403);
  }

  try {
    const existingSession = await getAppSession("admin");
    const session =
      existingSession ?? (featureFlags.allowDevBypass ? buildDemoSession("admin") : null);

    if (!session?.userId) {
      return fail("Sign in first, or explicitly enable development bypass for local testing.", 401);
    }

    const result = await createSampleCompany({
      session,
      companyName: `Test Company ${new Date().toISOString().slice(0, 10)}`,
      includeSampleData: true,
      adminFirstName: session.firstName,
      adminLastName: session.lastName,
      adminEmail: session.email,
    });

    logInfo("Development test company created.", {
      companyId: result.companyId,
      companySlug: result.companySlug,
    });

    const response = NextResponse.json({
      success: true,
      data: {
        ...result,
        redirectTo: `/admin?setup=ready&workspace=${encodeURIComponent(result.companyName)}&mode=sample&source=dev`,
      },
    });

    response.cookies.set(DEV_SESSION_COOKIE, "admin", {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });
    response.cookies.set(DEV_SESSION_COMPANY_ID_COOKIE, result.companyId, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });
    response.cookies.set(DEV_SESSION_COMPANY_SLUG_COOKIE, result.companySlug, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });
    response.cookies.set(DEV_SESSION_BRANCH_ID_COOKIE, result.branchId, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });

    return response;
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to create a development company.", 400);
  }
}
