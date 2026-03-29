import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { markAllAdminNotificationsAsRead } from "@/modules/admin/mutations";

export async function POST() {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(undefined, { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  try {
    const result = await markAllAdminNotificationsAsRead(tenant);
    return ok(result);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Unable to update notifications.",
      400,
    );
  }
}
