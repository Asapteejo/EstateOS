import { requireAdminSession } from "@/lib/auth/guards";
import { ok, fail } from "@/lib/http";
import { propertyCreateSchema } from "@/lib/validations/properties";
import { updatePropertyForAdmin } from "@/modules/properties/mutations";

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
  const body = propertyCreateSchema.safeParse(json);

  if (!body.success) {
    return fail("Invalid property update payload.");
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
