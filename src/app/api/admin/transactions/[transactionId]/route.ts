import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { adminTransactionStageSchema } from "@/lib/validations/transactions";
import { updateTransactionStageForAdmin } from "@/modules/transactions/mutations";
import {
  adminMutationRateLimit,
  enforceRateLimit,
  getClientIp,
} from "@/lib/rate-limit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ transactionId: string }> },
) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN", "FINANCE"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  const rateLimited = await enforceRateLimit(
    adminMutationRateLimit,
    [`ip:${getClientIp(request)}`, `user:${tenant.userId ?? "admin"}`],
    "Too many requests. Please slow down and try again.",
  );
  if (rateLimited) return rateLimited;

  const { transactionId } = await params;
  const json = (await request.json()) as Record<string, unknown>;
  const body = adminTransactionStageSchema.safeParse(json);
  if (!body.success) {
    return fail("Invalid transaction stage payload.");
  }

  try {
    const updated = await updateTransactionStageForAdmin(tenant, transactionId, body.data);
    return ok(updated);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update transaction.", 400);
  }
}
