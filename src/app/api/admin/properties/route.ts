import { requireAdminSession } from "@/lib/auth/guards";
import { ok, fail } from "@/lib/http";
import { propertyCreateSchema } from "@/lib/validations/properties";
import { getAdminPropertyManagementList } from "@/modules/properties/admin-queries";
import { createPropertyForAdmin } from "@/modules/properties/mutations";

export async function GET() {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(undefined, { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  try {
    const properties = await getAdminPropertyManagementList(tenant);
    return ok(properties);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load properties.", 400);
  }
}

export async function POST(request: Request) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(undefined, { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  const json = (await request.json()) as Record<string, unknown>;
  const body = propertyCreateSchema.safeParse(json);
  if (!body.success) {
    return fail("Invalid property payload.");
  }

  try {
    const created = await createPropertyForAdmin(tenant, {
      ...json,
      ...body.data,
    });
    return ok(created, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to create property.", 400);
  }
}
