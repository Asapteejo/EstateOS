import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { getCompanyWalletOverview } from "@/modules/communication/wallet";

export async function GET() {
  try {
    const tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });

    if (!tenant.companyId) {
      return fail("Tenant context is required.", 403);
    }

    const overview = await getCompanyWalletOverview(tenant.companyId, { take: 5 });
    return ok(overview);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load communication wallet.", 400);
  }
}
