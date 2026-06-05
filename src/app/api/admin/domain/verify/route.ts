import { requireAdminSession } from "@/lib/auth/guards";
import { featureFlags } from "@/lib/env";
import { fail, ok } from "@/lib/http";
import { verifyCompanyCustomDomain } from "@/modules/domains/service";
import {
  adminMutationRateLimit,
  enforceRateLimit,
  getClientIp,
} from "@/lib/rate-limit";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication required.", 401);
  }

  const rateLimited = await enforceRateLimit(
    adminMutationRateLimit,
    [`ip:${getClientIp(request)}`, `user:${tenant.userId ?? "admin"}`],
    "Too many requests. Please slow down and try again.",
  );
  if (rateLimited) return rateLimited;

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
