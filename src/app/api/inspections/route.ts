import { requirePortalSession } from "@/lib/auth/guards";
import { ok, fail } from "@/lib/http";
import { inspectionRateLimit } from "@/lib/rate-limit";
import { requirePublicTenantContext } from "@/lib/tenancy/context";
import { rejectUnsafeCompanyIdInput } from "@/lib/tenancy/db";
import { createInspectionBooking } from "@/modules/inspections/service";

export async function POST(request: Request) {
  const tenant = await requirePublicTenantContext();
  let viewer = null;
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  const json = (await request.json()) as Record<string, unknown>;

  try {
    viewer = await requirePortalSession({ redirectOnMissingAuth: false });
  } catch {}

  if (inspectionRateLimit) {
    const { success } = await inspectionRateLimit.limit(ip);
    if (!success) {
      return fail("Too many inspection requests. Please try again shortly.", 429);
    }
  }

  try {
    rejectUnsafeCompanyIdInput(json);
  } catch {
    return fail("Caller-provided companyId is not allowed.", 400);
  }

  try {
    const booking = await createInspectionBooking(tenant, json, viewer);
    return ok({ message: "Inspection booking submitted.", bookingId: booking.id }, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Invalid inspection booking payload.");
  }
}
