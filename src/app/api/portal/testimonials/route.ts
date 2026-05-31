import { ZodError } from "zod";

import { requirePortalSession } from "@/lib/auth/guards";
import { getAppSession } from "@/lib/auth/session";
import { fail, ok, validationFail } from "@/lib/http";
import { rejectUnsafeCompanyIdInput } from "@/lib/tenancy/db";
import { submitBuyerTestimonial } from "@/modules/testimonials/service";

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

  try {
    const session = await getAppSession("portal");
    const testimonial = await submitBuyerTestimonial(tenant, json, {
      email: session?.email,
    });
    return ok({
      message: "Sent for review.",
      testimonialId: testimonial.id,
      status: testimonial.status,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return validationFail(error);
    }

    return fail(error instanceof Error ? error.message : "Unable to submit testimonial.", 400);
  }
}
