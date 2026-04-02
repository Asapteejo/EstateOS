import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { syncPropertyVerificationStates } from "@/modules/properties/verification";

export async function POST() {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(undefined, { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  try {
    const result = await syncPropertyVerificationStates({
      companyId: tenant.companyId,
    });
    return ok(result);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to run verification sync.", 400);
  }
}
