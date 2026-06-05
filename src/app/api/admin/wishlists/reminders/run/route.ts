import { requireAdminSession } from "@/lib/auth/guards";
import { ok } from "@/lib/http";
import { runWishlistReminderSweep } from "@/modules/wishlist/service";
import {
  adminMutationRateLimit,
  enforceRateLimit,
  getClientIp,
} from "@/lib/rate-limit";

export async function POST(request: Request) {
  const session = await requireAdminSession(["ADMIN"]);

  const rateLimited = await enforceRateLimit(
    adminMutationRateLimit,
    [`ip:${getClientIp(request)}`, `user:${session.userId ?? "admin"}`],
    "Too many requests. Please slow down and try again.",
  );
  if (rateLimited) return rateLimited;

  const result = await runWishlistReminderSweep(new Date(), session.companyId ?? undefined);
  return ok(result);
}
