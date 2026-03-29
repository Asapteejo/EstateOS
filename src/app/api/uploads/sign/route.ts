import { randomUUID } from "node:crypto";

import { ok, fail } from "@/lib/http";
import { getPrivateUploadUrl } from "@/lib/storage/r2";
import { namespaceTenantStorageKey } from "@/lib/storage/paths";
import { requireTenantContext } from "@/lib/tenancy/context";
import { rejectUnsafeCompanyIdInput } from "@/lib/tenancy/db";
import { uploadRequestSchema } from "@/lib/validations/storage";

export async function POST(request: Request) {
  let tenant: Awaited<ReturnType<typeof requireTenantContext>>;
  try {
    tenant = await requireTenantContext("portal", { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }
  const json = (await request.json()) as Record<string, unknown>;
  try {
    rejectUnsafeCompanyIdInput(json);
  } catch {
    return fail("Caller-provided companyId is not allowed.", 400);
  }

  const body = uploadRequestSchema.safeParse(json);
  if (!body.success) {
    return fail("Invalid upload request.");
  }

  const key = namespaceTenantStorageKey(
    tenant,
    body.data.domain,
    body.data.fileName,
    randomUUID(),
  );
  const result = await getPrivateUploadUrl(key, body.data.contentType);

  return ok(result, { status: 201 });
}
