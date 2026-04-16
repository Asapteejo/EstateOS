import { requirePortalSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { buyerKycSubmissionSchema } from "@/lib/validations/kyc";
import { createBuyerKycSubmission } from "@/modules/kyc/service";

export async function POST(request: Request) {
  let tenant: Awaited<ReturnType<typeof requirePortalSession>>;
  try {
    tenant = await requirePortalSession({ redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail("Invalid request body.");
  }
  const body = buyerKycSubmissionSchema.safeParse(json);
  if (!body.success) {
    return fail("Invalid KYC submission payload.");
  }

  try {
    const created = await createBuyerKycSubmission(tenant, body.data);
    return ok(created, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to submit KYC.", 400);
  }
}
