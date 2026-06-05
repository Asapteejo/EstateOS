import { fail, ok } from "@/lib/http";
import { requireAdminSession } from "@/lib/auth/guards";
import { updateInquiryForAdmin } from "@/modules/inquiries/service";
import {
  adminMutationRateLimit,
  enforceRateLimit,
  getClientIp,
} from "@/lib/rate-limit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ inquiryId: string }> },
) {
  const tenant = await requireAdminSession(["ADMIN", "STAFF"]);

  const rateLimited = await enforceRateLimit(
    adminMutationRateLimit,
    [`ip:${getClientIp(request)}`, `user:${tenant.userId ?? "admin"}`],
    "Too many requests. Please slow down and try again.",
  );
  if (rateLimited) return rateLimited;

  const { inquiryId } = await params;
  const json = (await request.json()) as Record<string, unknown>;

  try {
    const inquiry = await updateInquiryForAdmin(tenant, inquiryId, json);
    return ok({ inquiry });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update inquiry.");
  }
}
