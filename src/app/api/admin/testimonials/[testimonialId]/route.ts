import { ZodError } from "zod";

import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok, validationFail } from "@/lib/http";
import { moderateTestimonialForAdmin } from "@/modules/testimonials/service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ testimonialId: string }> },
) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  const { testimonialId } = await params;
  const json = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!json) {
    return fail("Invalid request body.");
  }

  try {
    const testimonial = await moderateTestimonialForAdmin(tenant, testimonialId, json);
    return ok({ testimonial });
  } catch (error) {
    if (error instanceof ZodError) {
      return validationFail(error);
    }

    return fail(error instanceof Error ? error.message : "Unable to moderate testimonial.", 400);
  }
}
