import { fail, ok } from "@/lib/http";
import { requireTenantContext } from "@/lib/tenancy/context";
import { activateContractTemplateVersion } from "@/modules/contracts/service";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  let tenant: Awaited<ReturnType<typeof requireTenantContext>>;
  try {
    tenant = await requireTenantContext("admin", { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

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
