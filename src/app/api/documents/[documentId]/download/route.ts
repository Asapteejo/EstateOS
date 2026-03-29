import { ok, fail } from "@/lib/http";
import { getDocumentForTenantAccess, assertDocumentAccess } from "@/lib/documents/access";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { getPrivateDownloadUrl } from "@/lib/storage/r2";
import { isTenantStorageKey } from "@/lib/storage/paths";
import { requireTenantContext } from "@/lib/tenancy/context";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  let tenant: Awaited<ReturnType<typeof requireTenantContext>>;
  try {
    tenant = await requireTenantContext("portal", { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }
  const { documentId } = await params;

  const document = await getDocumentForTenantAccess(documentId, tenant);

  try {
    assertDocumentAccess(tenant, document);
  } catch {
    return fail("Document access denied.", 403);
  }

  if (!document) {
    return fail("Document not found.", 404);
  }

  if (!isTenantStorageKey(tenant, document.storageKey) && !tenant.isSuperAdmin) {
    return fail("Document storage namespace mismatch.", 403);
  }

  if (featureFlags.hasDatabase) {
    await prisma.documentAccessLog.create({
      data: {
        companyId: document.companyId,
        documentId: document.id,
        userId: tenant.userId,
        action: "DOWNLOAD",
      },
    });
  }

  const url = await getPrivateDownloadUrl(document.storageKey);

  return ok({
    fileName: document.fileName,
    url,
  });
}
