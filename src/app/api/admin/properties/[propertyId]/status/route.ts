import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { propertyStatusUpdateSchema } from "@/lib/validations/properties";
import { updatePropertyStatusForAdmin } from "@/modules/properties/mutations";
import {
  adminMutationRateLimit,
  enforceRateLimit,
  getClientIp,
} from "@/lib/rate-limit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ propertyId: string }> },
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

  const { propertyId } = await params;
  const json = (await request.json()) as Record<string, unknown>;
  const body = propertyStatusUpdateSchema.safeParse(json);
  if (!body.success) {
    return fail("Invalid property status payload.");
  }

  try {
    const updated = await updatePropertyStatusForAdmin(tenant, propertyId, body.data.status);
    return ok(updated);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update property status.", 400);
  }
}
