import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { propertyVerifySchema } from "@/lib/validations/properties";
import { verifyPropertyForAdmin } from "@/modules/properties/mutations";

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
