import { NextResponse } from "next/server";

import {
  DEV_SESSION_BRANCH_ID_COOKIE,
  DEV_SESSION_COMPANY_ID_COOKIE,
  DEV_SESSION_COMPANY_SLUG_COOKIE,
  DEV_SESSION_COOKIE,
  getAppSession,
} from "@/lib/auth/session";
import { fail } from "@/lib/http";
import { completeWorkspaceOnboarding } from "@/modules/onboarding/service";

export async function POST(request: Request) {
  try {
    const session = await getAppSession("admin");
    if (!session?.userId) {
      return fail("Authentication required.", 401);
    }

    const input = (await request.json()) as {
      companyName?: string;
      companySlug?: string;
      adminFirstName?: string;
      adminLastName?: string;
      adminEmail?: string;
      includeSampleData?: boolean;
    };

    const result = await completeWorkspaceOnboarding(session, {
      companyName: input.companyName ?? "",
      companySlug: input.companySlug ?? null,
      adminFirstName: input.adminFirstName ?? null,
      adminLastName: input.adminLastName ?? null,
      adminEmail: input.adminEmail ?? null,
      includeSampleData: input.includeSampleData === true,
    });

    const response = NextResponse.json({
      success: true,
      data: {
        ...result,
        redirectTo: `/admin?setup=ready&workspace=${encodeURIComponent(result.companyName)}&mode=${input.includeSampleData === true ? "sample" : "clean"}`,
      },
    });

    if (session.mode === "demo") {
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
    }

    return response;
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to complete onboarding.", 400);
  }
}
