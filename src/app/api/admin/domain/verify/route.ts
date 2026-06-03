import { requireAdminSession } from "@/lib/auth/guards";
import { featureFlags } from "@/lib/env";
import { fail, ok } from "@/lib/http";
import { verifyCompanyCustomDomain } from "@/modules/domains/service";
export const runtime = "nodejs";

export async function POST() {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication required.", 401);
  }

  if (!featureFlags.hasDatabase || !tenant.companyId) {
    return fail("Service unavailable.", 503);
  }

  let result: Awaited<ReturnType<typeof verifyCompanyCustomDomain>>;
  try {
    result = await verifyCompanyCustomDomain({
      companyId: tenant.companyId,
      actor: { userId: tenant.userId, source: "tenant_admin" },
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to verify custom domain.", 400);
  }

  return ok({
    verified: result.verified,
    reason: result.reason,
    dns: result.dns,
    vercel: result.vercel,
    company: result.company,
  });
}
