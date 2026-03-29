import { NextResponse } from "next/server";

import {
  checkDatabaseReadiness,
  buildDependencySummary,
  buildRuntimeReadinessSummary,
} from "@/lib/ops/health";

export async function GET() {
  const database = await checkDatabaseReadiness();
  const runtime = buildRuntimeReadinessSummary();
  const ok = database.ok && runtime.ok;

  return NextResponse.json(
    {
      ok,
      checks: {
        database,
        runtime,
      },
      dependencies: buildDependencySummary(),
    },
    {
      status: ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
