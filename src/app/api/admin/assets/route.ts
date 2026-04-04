import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { getTenantMediaLibrary } from "@/modules/uploads/library";

export async function GET() {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  try {
    const assets = await getTenantMediaLibrary(tenant);
    return ok(assets);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load assets.", 400);
  }
}
