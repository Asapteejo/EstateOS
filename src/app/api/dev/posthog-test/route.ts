import { featureFlags } from "@/lib/env";
import { fail, ok } from "@/lib/http";
import { captureServerEvent, captureServerException } from "@/lib/integrations/posthog";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!featureFlags.allowDevBypass) {
    return fail("Not found.", 404);
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "exception" ? "exception" : "event";

  if (mode === "exception") {
    await captureServerException(new Error("Intentional PostHog server test exception"), {
      source: "api",
      route: "/api/dev/posthog-test",
      method: "POST",
      area: "api",
      requestId: request.headers.get("x-vercel-id"),
      statusCode: 500,
    });

    return ok({ mode, captured: true });
  }

  await captureServerEvent(
    "estateos_posthog_server_test",
    { mode },
    {
      source: "api",
      route: "/api/dev/posthog-test",
      method: "POST",
      area: "api",
      requestId: request.headers.get("x-vercel-id"),
    },
  );

  return ok({ mode, captured: true });
}
