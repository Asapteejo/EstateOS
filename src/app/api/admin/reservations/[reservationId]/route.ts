import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { adminReservationStatusSchema } from "@/lib/validations/transactions";
import { updateReservationStatusForAdmin } from "@/modules/transactions/mutations";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reservationId: string }> },
) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(undefined, { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

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
