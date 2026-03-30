import { ok, fail } from "@/lib/http";
import { inquiryRateLimit } from "@/lib/rate-limit";
import { requirePortalSession } from "@/lib/auth/guards";
import { requirePublicTenantContext } from "@/lib/tenancy/context";
import { rejectUnsafeCompanyIdInput } from "@/lib/tenancy/db";
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

  try {
    const inquiry = await createInquiry(tenant, json, viewer);
    return ok({ message: "Inquiry received.", inquiryId: inquiry.id }, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Invalid inquiry payload.");
  }
}
