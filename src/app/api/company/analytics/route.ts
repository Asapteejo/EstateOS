import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/guards";
import { getCompanyAnalyticsReport, parseAnalyticsRange } from "@/modules/analytics/aggregates";

export async function GET(request: Request) {
  const tenant = await requireAdminSession(undefined, { redirectOnMissingAuth: false });
  const { searchParams } = new URL(request.url);
  const range = parseAnalyticsRange(searchParams.get("range"));
  const report = await getCompanyAnalyticsReport(tenant, range);

  return NextResponse.json(report);
}
