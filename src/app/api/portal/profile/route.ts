import { requireBuyerPortalSession } from "@/lib/auth/guards";
import { getAppSession } from "@/lib/auth/session";
import { fail, ok } from "@/lib/http";
import { buyerProfileSchema } from "@/lib/validations/profile";
import { saveBuyerProfileRecord } from "@/modules/kyc/service";

export async function PATCH(request: Request) {
  let tenant: Awaited<ReturnType<typeof requireBuyerPortalSession>>;
  try {
    tenant = await requireBuyerPortalSession({ redirectOnMissingAuth: false });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Authentication and buyer context are required.",
      401,
    );
  }

  const json = (await request.json()) as Record<string, unknown>;
  const body = buyerProfileSchema.safeParse(json);
  if (!body.success) {
    return fail("Invalid profile payload.");
  }

  try {
    const session = await getAppSession("portal");
    const updated = await saveBuyerProfileRecord(tenant, {
      ...json,
      ...body.data,
    }, {
      email: session?.email,
    });
    return ok(updated);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to save profile.", 400);
  }
}
