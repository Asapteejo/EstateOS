import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { adminKycReviewSchema } from "@/lib/validations/kyc";
import { reviewKycSubmission } from "@/modules/kyc/service";
import {
  adminMutationRateLimit,
  enforceRateLimit,
  getClientIp,
} from "@/lib/rate-limit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN", "LEGAL"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  const rateLimited = await enforceRateLimit(
    adminMutationRateLimit,
    [`ip:${getClientIp(request)}`, `user:${tenant.userId ?? "admin"}`],
    "Too many requests. Please slow down and try again.",
  );
  if (rateLimited) return rateLimited;

  const { submissionId } = await params;
  const json = (await request.json()) as Record<string, unknown>;
  const body = adminKycReviewSchema.safeParse(json);
  if (!body.success) {
    return fail("Invalid KYC review payload.");
  }

  try {
    const updated = await reviewKycSubmission(tenant, submissionId, body.data);
    return ok(updated);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update KYC review.", 400);
  }
}
