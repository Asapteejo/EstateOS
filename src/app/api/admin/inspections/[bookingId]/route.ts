import { fail, ok } from "@/lib/http";
import { requireAdminSession } from "@/lib/auth/guards";
import { updateInspectionBookingForAdmin } from "@/modules/inspections/service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const tenant = await requireAdminSession();
  const { bookingId } = await params;
  const json = (await request.json()) as Record<string, unknown>;

  try {
    const booking = await updateInspectionBookingForAdmin(tenant, bookingId, json);
    return ok({ booking });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update inspection booking.");
  }
}
