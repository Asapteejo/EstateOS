import { isSuperadminAccessError, requireSuperAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { getCompanyWalletOverview } from "@/modules/communication/wallet";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  try {
    await requireSuperAdminSession({ redirectOnMissingAuth: false });
    const { companyId } = await params;
    const overview = await getCompanyWalletOverview(companyId, { take: 10 });
    return ok(overview);
  } catch (error) {
    if (isSuperadminAccessError(error)) {
      return fail(error.message, 403);
    }
    return fail(error instanceof Error ? error.message : "Unable to load wallet.", 400);
  }
}
