import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { loadSampleWorkspaceForTenant } from "@/modules/admin/sample-workspace";

export async function POST() {
  try {
    const tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
    const result = await loadSampleWorkspaceForTenant(tenant);
    return ok(result, { status: result.loaded ? 201 : 200 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load sample workspace.", 400);
  }
}
