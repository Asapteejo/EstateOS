import { requireSuperAdminSession, requireAdminSession, requirePortalSession } from "@/lib/auth/guards";
import { fail } from "@/lib/http";
import { subscribeRealtimeEvents, type PlatformRealtimeEvent } from "@/lib/realtime/events";

export const runtime = "nodejs";

function createSseResponse(input: {
  scope: "superadmin" | "company";
  companyId?: string | null;
  signal: AbortSignal;
}) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const writeEvent = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      writeEvent("ready", {
        scope: input.scope,
        companyId: input.companyId ?? null,
      });

      const unsubscribe = subscribeRealtimeEvents((event: PlatformRealtimeEvent) => {
        if (input.scope === "company" && input.companyId && event.companyId !== input.companyId) {
          return;
        }

        writeEvent("message", event);
      });

      const heartbeat = setInterval(() => {
        writeEvent("ping", { at: new Date().toISOString() });
      }, 20000);

      const close = () => {
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      };

      input.signal.addEventListener("abort", close, { once: true });
    },
    cancel() {
      return undefined;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channel = searchParams.get("channel");
  const surface = searchParams.get("surface");

  try {
    if (channel === "superadmin") {
      await requireSuperAdminSession({ redirectOnMissingAuth: false });
      return createSseResponse({ scope: "superadmin", signal: request.signal });
    }

    const tenant =
      surface === "portal"
        ? await requirePortalSession({ redirectOnMissingAuth: false })
        : await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });

    return createSseResponse({
      scope: "company",
      companyId: tenant.companyId,
      signal: request.signal,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Realtime stream unavailable.", 401);
  }
}
