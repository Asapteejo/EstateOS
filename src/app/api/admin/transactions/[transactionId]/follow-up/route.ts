import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { adminTransactionFollowUpSchema } from "@/lib/validations/transactions";
import { updateTransactionFollowUpForAdmin } from "@/modules/transactions/mutations";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ transactionId: string }> },
) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(undefined, { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  const { transactionId } = await params;
  const json = (await request.json()) as Record<string, unknown>;
  const body = adminTransactionFollowUpSchema.safeParse(json);
  if (!body.success) {
    return fail("Invalid follow-up payload.", 400);
  }

  try {
    const updated = await updateTransactionFollowUpForAdmin(tenant, transactionId, body.data);
    return ok(updated);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update follow-up.", 400);
  }
}
