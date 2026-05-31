import { NextResponse } from "next/server";

import { isSuperadminAccessError, requireSuperAdminSession } from "@/lib/auth/guards";
import { fail } from "@/lib/http";
import { getPlatformAnalyticsReport, parseAnalyticsRange } from "@/modules/analytics/aggregates";

export async function GET(request: Request) {
  try {
    await requireSuperAdminSession({ redirectOnMissingAuth: false });

    const { searchParams } = new URL(request.url);
    const range = parseAnalyticsRange(searchParams.get("range"));
    const report = await getPlatformAnalyticsReport(range);

    return NextResponse.json(report);
  } catch (error) {
    if (isSuperadminAccessError(error)) {
      return fail(error.message, 403);
    }
    throw error;
  }
}
