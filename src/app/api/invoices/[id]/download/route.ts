import { requireAdminSession, requirePortalSession } from "@/lib/auth/guards";
import { fail } from "@/lib/http";
import { getInvoiceDocumentForViewer, renderInvoiceHtml } from "@/modules/invoices/service";

async function resolveViewer() {
  try {
    return await requirePortalSession({ redirectOnMissingAuth: false });
  } catch {
    return requireAdminSession(["ADMIN", "STAFF", "LEGAL", "FINANCE"], { redirectOnMissingAuth: false });
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let viewer: Awaited<ReturnType<typeof resolveViewer>>;
  try {
    viewer = await resolveViewer();
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  try {
    const { id } = await params;
    const doc = await getInvoiceDocumentForViewer(viewer, id);
    const html = renderInvoiceHtml(doc);
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${doc.invoiceNumber}.html"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/access|denied|permission/i.test(message)) {
      return fail("Access denied.", 403);
    }
    return fail("Invoice not found.", 404);
  }
}
