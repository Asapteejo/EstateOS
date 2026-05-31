import { ZodError } from "zod";

import { requirePortalSession } from "@/lib/auth/guards";
import { getAppSession } from "@/lib/auth/session";
import { fail, ok, validationFail } from "@/lib/http";
import { rejectUnsafeCompanyIdInput } from "@/lib/tenancy/db";
import { resubmitBuyerTestimonial } from "@/modules/testimonials/service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ testimonialId: string }> },
) {
  let tenant: Awaited<ReturnType<typeof requirePortalSession>>;
  try {
    tenant = await requirePortalSession({ redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  const { testimonialId } = await params;

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

  try {
    const session = await getAppSession("portal");
    const testimonial = await resubmitBuyerTestimonial(tenant, testimonialId, json, {
      email: session?.email,
    });
    return ok({
      message: "Sent for review.",
      testimonialId: testimonial.id,
      status: testimonial.status,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return validationFail(error);
    }

    return fail(error instanceof Error ? error.message : "Unable to resubmit testimonial.", 400);
  }
}
