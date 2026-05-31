import { fail } from "@/lib/http";
import { getDocumentForTenantAccess, assertDocumentAccess, writeDocumentAccessLog } from "@/lib/documents/access";
import { getAppSession } from "@/lib/auth/session";
import { getPrivateDownloadUrl } from "@/lib/storage/r2";
import { isTenantStorageKey } from "@/lib/storage/paths";
import { requireTenantContext } from "@/lib/tenancy/context";
import { resolveBuyerTenantContextForKyc } from "@/modules/kyc/buyer-user";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  let tenant: Awaited<ReturnType<typeof requireTenantContext>>;
  try {
    tenant = await requireTenantContext("admin", { redirectOnMissingAuth: false });
  } catch {
    try {
      tenant = await requireTenantContext("portal", { redirectOnMissingAuth: false });
    } catch {
      return fail("Authentication and tenant context are required.", 401);
    }
  }
  const { documentId } = await params;
  const session = await getAppSession(tenant.roles.includes("BUYER") ? "portal" : "admin");
  const accessTenant = tenant.roles.includes("BUYER")
    ? await resolveBuyerTenantContextForKyc(tenant, { email: session?.email }).catch(() => tenant)
    : tenant;

  const document = await getDocumentForTenantAccess(documentId, accessTenant);

  try {
    assertDocumentAccess(accessTenant, document);
  } catch {
    return fail("Document access denied.", 403);
  }

  if (!document) {
    return fail("Document not found.", 404);
  }

  if (!isTenantStorageKey(accessTenant, document.storageKey) && !accessTenant.isSuperAdmin) {
    return fail("Document storage namespace mismatch.", 403);
  }

  await writeDocumentAccessLog({
    context: accessTenant,
    document,
    action: "DOWNLOAD",
    email: session?.email,
  });

  const requestUrl = new URL(request.url);
  const disposition = requestUrl.searchParams.get("disposition") === "attachment"
    ? "attachment"
    : "inline";
  const url = await getPrivateDownloadUrl(document.storageKey, {
    fileName: document.fileName,
    contentType: document.mimeType,
    disposition,
  });

  return Response.redirect(url, 302);
}
