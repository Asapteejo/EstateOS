import { ok, fail, validationFail, safeValidationIssues } from "@/lib/http";
import { featureFlags } from "@/lib/env";
import { logWarn } from "@/lib/ops/logger";
import { inquiryRateLimit } from "@/lib/rate-limit";
import { requirePortalSession } from "@/lib/auth/guards";
import { requirePublicTenantContext } from "@/lib/tenancy/context";
import { rejectUnsafeCompanyIdInput } from "@/lib/tenancy/db";
import { inquirySchema } from "@/lib/validations/inquiries";
import { createInquiry } from "@/modules/inquiries/service";

export async function POST(request: Request) {
  const tenant = await requirePublicTenantContext();
  let viewer = null;
  const ip = request.headers.get("x-forwarded-for") ?? "local";

  try {
    viewer = await requirePortalSession({ redirectOnMissingAuth: false });
  } catch {}

  if (inquiryRateLimit) {
    const { success } = await inquiryRateLimit.limit(ip);
    if (!success) {
      return fail("Too many inquiries. Please try again shortly.", 429);
    }
  }

  const json = (await request.json()) as Record<string, unknown>;
  try {
    rejectUnsafeCompanyIdInput(json);
  } catch {
    return fail("Caller-provided companyId is not allowed.", 400);
  }

  const body = inquirySchema.safeParse(json);
  if (!body.success) {
    const issues = safeValidationIssues(body.error);
    if (!featureFlags.isProduction) {
      logWarn("Public inquiry validation failed.", { issues });
    }
    return validationFail(body.error);
  }

  try {
    const inquiry = await createInquiry(tenant, body.data, viewer);
    return ok({ message: "Inquiry received.", inquiryId: inquiry.id }, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Invalid inquiry payload.");
  }
}
