import { requireAdminSession } from "@/lib/auth/guards";
import { featureFlags } from "@/lib/env";
import { generateFeasibilityNarrative } from "@/modules/development-calculations/recommendations";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ calculationId: string }> },
) {
  const tenant = await requireAdminSession(["ADMIN"]);
  const { calculationId } = await params;

  if (!featureFlags.hasGeminiAi) {
    return Response.json({ error: "AI narrative is not configured." }, { status: 503 });
  }

  try {
    const stream = await generateFeasibilityNarrative(tenant, calculationId);
    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "Calculation not found.") {
      return Response.json({ error: message }, { status: 404 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
