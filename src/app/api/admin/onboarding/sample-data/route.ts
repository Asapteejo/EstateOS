import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { loadSampleWorkspaceForTenant } from "@/modules/admin/sample-workspace";
import {
  adminMutationRateLimit,
  enforceRateLimit,
  getClientIp,
} from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });

    const rateLimited = await enforceRateLimit(
      adminMutationRateLimit,
      [`ip:${getClientIp(request)}`, `user:${tenant.userId ?? "admin"}`],
      "Too many requests. Please slow down and try again.",
    );
    if (rateLimited) return rateLimited;

    const result = await loadSampleWorkspaceForTenant(tenant);
    return ok(result, { status: result.loaded ? 201 : 200 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load sample workspace.", 400);
  }
}
