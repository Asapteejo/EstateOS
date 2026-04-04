import { prisma } from "@/lib/db/prisma";
import { fail, ok } from "@/lib/http";
import { buildUploadDocumentMetadata } from "@/lib/uploads/document-metadata";
import { isTenantStorageKey } from "@/lib/storage/paths";
import { requireTenantContext } from "@/lib/tenancy/context";
import { rejectUnsafeCompanyIdInput } from "@/lib/tenancy/db";
import { completeUploadSchema } from "@/lib/validations/storage";
import { featureFlags } from "@/lib/env";
import { getUploadPurposeConfig } from "@/modules/uploads/config";

export async function POST(request: Request) {
  const json = (await request.json()) as Record<string, unknown>;

  try {
    rejectUnsafeCompanyIdInput(json);
  } catch {
    return fail("Caller-provided companyId is not allowed.", 400);
  }

  const body = completeUploadSchema.safeParse(json);
  if (!body.success) {
    return fail("Invalid upload completion payload.");
  }

  let tenant: Awaited<ReturnType<typeof requireTenantContext>>;
  try {
    tenant = await requireTenantContext(body.data.surface, { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  if (!tenant.companyId) {
    return fail("Tenant context is required.", 400);
  }

  if (!isTenantStorageKey(tenant, body.data.storageKey)) {
    return fail("Upload storage namespace mismatch.", 403);
  }

  const config = getUploadPurposeConfig(body.data.purpose);
  if (!config.documentType) {
    return fail("This upload purpose does not create a document record.", 400);
  }

  if (!featureFlags.hasDatabase) {
    return ok(
      {
        id: `demo-${body.data.purpose.toLowerCase()}-${body.data.fileName.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}`,
        fileName: body.data.fileName,
        storageKey: body.data.storageKey,
      },
      { status: 201 },
    );
  }

  const document = await prisma.document.create({
    data: {
      companyId: tenant.companyId,
      userId: body.data.surface === "portal" ? tenant.userId : null,
      fileName: body.data.fileName,
      storageKey: body.data.storageKey,
      mimeType: body.data.mimeType,
      sizeBytes: body.data.sizeBytes,
      documentType: config.documentType,
      visibility: config.visibility,
      uploadedByUserId: tenant.userId ?? undefined,
      createdForUserId: body.data.surface === "portal" ? tenant.userId ?? undefined : undefined,
      metadata: buildUploadDocumentMetadata(body.data.purpose),
    },
    select: {
      id: true,
      fileName: true,
      storageKey: true,
    },
  });

  return ok(document, { status: 201 });
}
