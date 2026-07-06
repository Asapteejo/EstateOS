import {
  isSuperadminAccessError,
  requireSuperAdminSession,
  requireAdminSession,
  requirePortalSession,
} from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import {
  isChangeCounterEnabled,
  readChangeVersion,
} from "@/lib/realtime/change-counter";

/**
 * Conditional-polling version check — the cheap replacement for blind
 * 30-second router.refresh() polling. Returns the current change counter for
 * the caller's surface (one Redis GET). Clients re-render only when the
 * number moves. Auth mirrors /api/realtime/stream: the company id comes from
 * the SESSION, never from the query string, so tenants can only ever watch
 * their own counter.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channel = searchParams.get("channel");
  const surface = searchParams.get("surface");

  if (!isChangeCounterEnabled()) {
    return ok(
      { enabled: false, version: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    if (channel === "superadmin") {
      await requireSuperAdminSession({ redirectOnMissingAuth: false });
      const version = await readChangeVersion({ scope: "platform" });
      return ok(
        { enabled: version !== null, version },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const tenant =
      surface === "portal"
        ? await requirePortalSession({ redirectOnMissingAuth: false })
        : await requireAdminSession(undefined, { redirectOnMissingAuth: false });

    const version = tenant.companyId
      ? await readChangeVersion({ scope: "company", companyId: tenant.companyId })
      : null;

    return ok(
      { enabled: version !== null, version },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Realtime version unavailable.",
      isSuperadminAccessError(error) ? 403 : 401,
    );
  }
}
