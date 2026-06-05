import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { wishlistFollowUpMutationSchema } from "@/lib/validations/saved-properties";
import { updateWishlistFollowUpForAdmin } from "@/modules/wishlist/service";
import {
  adminMutationRateLimit,
  enforceRateLimit,
  getClientIp,
} from "@/lib/rate-limit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ wishlistId: string }> },
) {
  const tenant = await requireAdminSession(["ADMIN"]);

  const rateLimited = await enforceRateLimit(
    adminMutationRateLimit,
    [`ip:${getClientIp(request)}`, `user:${tenant.userId ?? "admin"}`],
    "Too many requests. Please slow down and try again.",
  );
  if (rateLimited) return rateLimited;

  const { wishlistId } = await params;
  const json = (await request.json()) as Record<string, unknown>;
  const body = wishlistFollowUpMutationSchema.safeParse(json);

  if (!body.success) {
    return fail("Invalid wishlist follow-up payload.");
  }

  try {
    const result = await updateWishlistFollowUpForAdmin(tenant, wishlistId, body.data);
    return ok(result);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update wishlist follow-up.", 400);
  }
}
