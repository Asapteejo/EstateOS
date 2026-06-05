import { requirePortalSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { reservationCreateSchema } from "@/lib/validations/reservations";
import { createReservationForBuyer } from "@/modules/portal/mutations";
import {
  enforceRateLimit,
  getClientIp,
  reservationRateLimit,
} from "@/lib/rate-limit";

export async function POST(request: Request) {
  let tenant: Awaited<ReturnType<typeof requirePortalSession>>;
  try {
    tenant = await requirePortalSession({ redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  const rateLimited = await enforceRateLimit(
    reservationRateLimit,
    [`ip:${getClientIp(request)}`, `user:${tenant.userId ?? "anon"}`],
    "Too many reservation attempts. Please wait a moment and try again.",
  );
  if (rateLimited) return rateLimited;

  const json = (await request.json()) as Record<string, unknown>;
  const body = reservationCreateSchema.safeParse(json);

  if (!body.success) {
    return fail("Invalid reservation payload.");
  }

  try {
    const result = await createReservationForBuyer(tenant, body.data);
    return ok(result, { status: 201 });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Unable to create reservation.",
      400,
    );
  }
}
