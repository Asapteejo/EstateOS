import { requireAdminSession } from "@/lib/auth/guards";
import { ok } from "@/lib/http";
import { runWishlistReminderSweep } from "@/modules/wishlist/service";

export async function POST() {
  await requireAdminSession(["ADMIN"]);
  const result = await runWishlistReminderSweep();
  return ok(result);
}
