import { requireSuperAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { getCompanyWalletOverview } from "@/modules/communication/wallet";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  try {
    await requireSuperAdminSession({ redirectOnMissingAuth: false });
    const { companyId } = await params;
    const overview = await getCompanyWalletOverview(companyId, { take: 50 });
    return ok({ ledger: overview.ledger });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load wallet ledger.", 400);
  }
}
