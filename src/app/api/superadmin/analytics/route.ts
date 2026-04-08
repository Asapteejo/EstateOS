import { NextResponse } from "next/server";

import { requireSuperAdminSession } from "@/lib/auth/guards";
import { getPlatformAnalyticsReport, parseAnalyticsRange } from "@/modules/analytics/aggregates";

export async function GET(request: Request) {
  await requireSuperAdminSession({ redirectOnMissingAuth: false });

  const { searchParams } = new URL(request.url);
  const range = parseAnalyticsRange(searchParams.get("range"));
  const report = await getPlatformAnalyticsReport(range);

  return NextResponse.json(report);
}
