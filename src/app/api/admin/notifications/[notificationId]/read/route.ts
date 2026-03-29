import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { markAdminNotificationAsRead } from "@/modules/admin/mutations";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ notificationId: string }> },
) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(undefined, { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  const { notificationId } = await params;

  try {
    const result = await markAdminNotificationAsRead(tenant, notificationId);
    return ok(result);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Unable to update notification.",
      400,
    );
  }
}
