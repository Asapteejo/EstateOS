import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { adminReservationStatusSchema } from "@/lib/validations/transactions";
import { updateReservationStatusForAdmin } from "@/modules/transactions/mutations";
import {
  adminMutationRateLimit,
  enforceRateLimit,
  getClientIp,
} from "@/lib/rate-limit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reservationId: string }> },
) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN", "STAFF"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  const rateLimited = await enforceRateLimit(
    adminMutationRateLimit,
    [`ip:${getClientIp(request)}`, `user:${tenant.userId ?? "admin"}`],
    "Too many requests. Please slow down and try again.",
  );
  if (rateLimited) return rateLimited;

  const { reservationId } = await params;
  const json = (await request.json()) as Record<string, unknown>;
  const body = adminReservationStatusSchema.safeParse(json);
  if (!body.success) {
    return fail("Invalid reservation status payload.");
  }

  try {
    const updated = await updateReservationStatusForAdmin(tenant, reservationId, body.data);
    return ok(updated);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update reservation.", 400);
  }
}
