import { requireAdminSession } from "@/lib/auth/guards";
import { ok, fail, safeValidationIssues, validationFail } from "@/lib/http";
import { propertyCreateSchema } from "@/lib/validations/properties";
import { updatePropertyForAdmin } from "@/modules/properties/mutations";
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
  const body = propertyCreateSchema.safeParse(json);

  if (!body.success) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Property update validation failed.", {
        propertyId,
        issues: safeValidationIssues(body.error),
      });
    }

    return validationFail(body.error);
  }

  try {
    const updated = await updatePropertyForAdmin(tenant, propertyId, {
      ...json,
      ...body.data,
    });
    return ok(updated);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update property.", 400);
  }
}
