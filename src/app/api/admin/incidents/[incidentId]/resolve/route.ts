import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { markObservedIncidentResolved } from "@/modules/incidents/service";
import {
  adminMutationRateLimit,
  enforceRateLimit,
  getClientIp,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ incidentId: string }> },
) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  const rateLimited = await enforceRateLimit(
    adminMutationRateLimit,
    [`ip:${getClientIp(request)}`, `user:${tenant.userId ?? "admin"}`],
    "Too many requests. Please slow down and try again.",
  );
  if (rateLimited) return rateLimited;

  const rawParams = await params;
  if (!rawParams.incidentId?.trim()) {
    return fail("Invalid incident identifier.", 400);
  }

  try {
    const incident = await markObservedIncidentResolved({
      tenant,
      incidentId: rawParams.incidentId,
    });

    return ok(incident);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Unable to mark incident as resolved.",
      400,
    );
  }
}
