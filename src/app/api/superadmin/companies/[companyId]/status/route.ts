import { isSuperadminAccessError, requireSuperAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { companyLifecycleUpdateSchema } from "@/lib/validations/superadmin";
import { updateCompanyLifecycleStatus } from "@/modules/superadmin/company-lifecycle";
import {
  adminMutationRateLimit,
  enforceRateLimit,
  getClientIp,
} from "@/lib/rate-limit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  try {
    const tenant = await requireSuperAdminSession({ redirectOnMissingAuth: false });

    const rateLimited = await enforceRateLimit(
      adminMutationRateLimit,
      [`ip:${getClientIp(request)}`, `user:${tenant.userId ?? "superadmin"}`],
      "Too many requests. Please slow down and try again.",
    );
    if (rateLimited) return rateLimited;

    const { companyId } = await params;
    const json = (await request.json()) as Record<string, unknown>;
    const body = companyLifecycleUpdateSchema.safeParse(json);

    if (!body.success) {
      return fail("Invalid company lifecycle payload.", 400);
    }

    const result = await updateCompanyLifecycleStatus(tenant, companyId, body.data);
    return ok(result);
  } catch (error) {
    if (isSuperadminAccessError(error)) {
      return fail(error.message, 403);
    }
    return fail(error instanceof Error ? error.message : "Unable to update company status.", 400);
  }
}
