import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { fetchPaystackBanks } from "@/lib/payments/paystack";

export async function GET() {
  try {
    await requireAdminSession(undefined, { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication required.", 401);
  }

  try {
    const banks = await fetchPaystackBanks();
    return ok({ banks });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to fetch banks.", 502);
  }
}
