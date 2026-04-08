import { requireSuperAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { companyLifecycleUpdateSchema } from "@/lib/validations/superadmin";
import { updateCompanyLifecycleStatus } from "@/modules/superadmin/company-lifecycle";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  try {
    const tenant = await requireSuperAdminSession({ redirectOnMissingAuth: false });
    const { companyId } = await params;
    const json = (await request.json()) as Record<string, unknown>;
    const body = companyLifecycleUpdateSchema.safeParse(json);

    if (!body.success) {
      return fail("Invalid company lifecycle payload.", 400);
    }

    const result = await updateCompanyLifecycleStatus(tenant, companyId, body.data);
    return ok(result);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update company status.", 400);
  }
}
