import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { propertyVerifySchema } from "@/lib/validations/properties";
import { verifyPropertyForAdmin } from "@/modules/properties/mutations";
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
  const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const body = propertyVerifySchema.safeParse(json);
  if (!body.success) {
    return fail("Invalid property verification payload.");
  }

  try {
    const updated = await verifyPropertyForAdmin(tenant, propertyId, body.data.notes);
    return ok(updated);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to verify property.", 400);
  }
}
