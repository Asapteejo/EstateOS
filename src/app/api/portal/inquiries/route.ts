import { requirePortalSession } from "@/lib/auth/guards";
import { getAppSession } from "@/lib/auth/session";
import { featureFlags } from "@/lib/env";
import { ok, fail, safeValidationIssues, validationFail } from "@/lib/http";
import { logWarn } from "@/lib/ops/logger";
import { rejectUnsafeCompanyIdInput } from "@/lib/tenancy/db";
import { portalInquirySchema } from "@/lib/validations/inquiries";
import { createPortalInquiry } from "@/modules/inquiries/service";

export async function POST(request: Request) {
  let tenant: Awaited<ReturnType<typeof requirePortalSession>>;
  try {
    tenant = await requirePortalSession({ redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  let json: Record<string, unknown>;
  try {
    json = (await request.json()) as Record<string, unknown>;
  } catch {
    return fail("Invalid request body.");
  }

  try {
    rejectUnsafeCompanyIdInput(json);
  } catch {
    return fail("Caller-provided companyId is not allowed.", 400);
  }

  const body = portalInquirySchema.safeParse(json);
  if (!body.success) {
    const issues = safeValidationIssues(body.error);
    if (!featureFlags.isProduction) {
      logWarn("Portal inquiry validation failed.", { issues });
    }
    return validationFail(body.error);
  }

  try {
    const session = await getAppSession("portal");
    const inquiry = await createPortalInquiry(tenant, body.data, {
      email: session?.email,
    });
    return ok({
      message: `Your inquiry has been sent to ${inquiry.companyName} sales team.`,
      inquiryId: inquiry.id,
      companyName: inquiry.companyName,
    }, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to submit inquiry.", 400);
  }
}
