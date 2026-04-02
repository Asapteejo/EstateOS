import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { tenantSettingsSchema } from "@/lib/validations/settings";
import { getTenantAdminSettings, updateTenantAdminSettings } from "@/modules/settings/service";

export async function GET() {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  try {
    const settings = await getTenantAdminSettings(tenant);
    return ok(settings);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load settings.", 400);
  }
}

export async function PATCH(request: Request) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  const json = (await request.json()) as Record<string, unknown>;
  const body = tenantSettingsSchema.safeParse(json);
  if (!body.success) {
    return fail("Invalid tenant settings payload.");
  }

  try {
    const settings = await updateTenantAdminSettings(tenant, {
      ...json,
      ...body.data,
    });
    return ok(settings);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update settings.", 400);
  }
}
