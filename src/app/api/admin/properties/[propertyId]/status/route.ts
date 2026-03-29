import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { propertyStatusUpdateSchema } from "@/lib/validations/properties";
import { updatePropertyStatusForAdmin } from "@/modules/properties/mutations";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(undefined, { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

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
