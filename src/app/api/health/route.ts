import { NextResponse } from "next/server";

import {
  buildDependencySummary,
  buildHealthSnapshot,
  buildRuntimeReadinessSummary,
} from "@/lib/ops/health";

export async function GET() {
  return NextResponse.json(
    {
      ...buildHealthSnapshot(),
      dependencies: buildDependencySummary(),
      runtime: buildRuntimeReadinessSummary(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
