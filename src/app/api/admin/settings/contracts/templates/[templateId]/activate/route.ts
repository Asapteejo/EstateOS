import { fail, ok } from "@/lib/http";
import { requireAdminSession } from "@/lib/auth/guards";
import { activateContractTemplateVersion } from "@/modules/contracts/service";
import {
  adminMutationRateLimit,
  enforceRateLimit,
  getClientIp,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN", "LEGAL"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  const rateLimited = await enforceRateLimit(
    adminMutationRateLimit,
    [`ip:${getClientIp(request)}`, `user:${tenant.userId ?? "admin"}`],
    "Too many requests. Please slow down and try again.",
  );
  if (rateLimited) return rateLimited;

  if (!tenant.companyId) {
    return fail("Tenant context is required.", 400);
  }

  const { templateId } = await params;
  if (!templateId) {
    return fail("Template id is required.", 400);
  }

  try {
    return ok(await activateContractTemplateVersion({
      companyId: tenant.companyId,
      templateId,
      actorUserId: tenant.userId,
      actorEmail: tenant.email,
      actorIsSuperAdmin: tenant.isSuperAdmin,
    }));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to activate contract template.", 400);
  }
}
