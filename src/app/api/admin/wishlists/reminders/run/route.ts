import { requireAdminSession } from "@/lib/auth/guards";
import { ok } from "@/lib/http";
import { runWishlistReminderSweep } from "@/modules/wishlist/service";

export async function POST() {
  const session = await requireAdminSession(["ADMIN"]);
  const result = await runWishlistReminderSweep(new Date(), session.companyId ?? undefined);
  return ok(result);
}
