import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { markObservedIncidentUnignored } from "@/modules/incidents/service";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ incidentId: string }> },
) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  const rawParams = await params;
  if (!rawParams.incidentId?.trim()) {
    return fail("Invalid incident identifier.", 400);
  }

  try {
    const incident = await markObservedIncidentUnignored({
      tenant,
      incidentId: rawParams.incidentId,
    });

    return ok(incident);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Unable to remove ignore from incident.",
      400,
    );
  }
}
