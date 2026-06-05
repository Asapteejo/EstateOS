import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { updateFeasibilityDecisionStatus } from "@/modules/development-calculations/service";
import {
  adminMutationRateLimit,
  enforceRateLimit,
  getClientIp,
} from "@/lib/rate-limit";

const VALID_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
type DecisionStatus = (typeof VALID_STATUSES)[number];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ calculationId: string }> },
) {
  try {
    const tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });

    const rateLimited = await enforceRateLimit(
      adminMutationRateLimit,
      [`ip:${getClientIp(request)}`, `user:${tenant.userId ?? "admin"}`],
      "Too many requests. Please slow down and try again.",
    );
    if (rateLimited) return rateLimited;

    const { calculationId } = await params;
    const json = (await request.json()) as { status?: unknown };

    if (!json.status || !VALID_STATUSES.includes(json.status as DecisionStatus)) {
      return fail("status must be PENDING, APPROVED, or REJECTED.", 400);
    }

    const result = await updateFeasibilityDecisionStatus(
      tenant,
      calculationId,
      json.status as DecisionStatus,
    );
    return ok(result);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update decision status.", 400);
  }
}
