import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { adminKycReviewSchema } from "@/lib/validations/kyc";
import { reviewKycSubmission } from "@/modules/kyc/service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(undefined, { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

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
