import { ok, fail } from "@/lib/http";
import { requireAdminSession } from "@/lib/auth/guards";
import { rejectUnsafeCompanyIdInput } from "@/lib/tenancy/db";
import { contractSettingsSchema } from "@/lib/validations/contracts";
import {
  getCompanyContractSettings,
  upsertCompanyContractSettings,
} from "@/modules/contracts/service";
import {
  adminMutationRateLimit,
  enforceRateLimit,
  getClientIp,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET() {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN", "LEGAL"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  try {
    return ok(await getCompanyContractSettings(tenant));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load contract settings.", 400);
  }
}

export async function PATCH(request: Request) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN", "LEGAL"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  const rateLimited = await enforceRateLimit(
    adminMutationRateLimit,
    [`ip:${getClientIp(request)}`, `user:${tenant.userId ?? "admin"}`],
    "Too many requests. Please slow down and try again.",
  );
  if (rateLimited) return rateLimited;

  const json = (await request.json()) as Record<string, unknown>;
  try {
    rejectUnsafeCompanyIdInput(json);
  } catch {
    return fail("Caller-provided companyId is not allowed.", 400);
  }

  const body = contractSettingsSchema.safeParse(json);
  if (!body.success) {
    return fail("Invalid contract settings payload.", 400);
  }

  try {
    return ok(await upsertCompanyContractSettings(tenant, body.data));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to save contract settings.", 400);
  }
}
