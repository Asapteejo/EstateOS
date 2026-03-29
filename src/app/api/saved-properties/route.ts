import { requirePortalSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { savedPropertyMutationSchema } from "@/lib/validations/saved-properties";
import { savePropertyForBuyer } from "@/modules/portal/mutations";

export async function POST(request: Request) {
  let tenant: Awaited<ReturnType<typeof requirePortalSession>>;
  try {
    tenant = await requirePortalSession({ redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  const json = (await request.json()) as Record<string, unknown>;
  const body = savedPropertyMutationSchema.safeParse(json);

  if (!body.success) {
    return fail("Invalid saved property payload.");
  }

  try {
    const result = await savePropertyForBuyer(tenant, body.data);
    return ok(result, { status: 200 });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Unable to update saved property.",
      400,
    );
  }
}
