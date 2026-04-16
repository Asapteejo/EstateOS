import { requireAdminSession, requirePortalSession } from "@/lib/auth/guards";
import { fail } from "@/lib/http";
import { getReceiptForViewer, renderReceiptHtml } from "@/modules/receipts/service";

async function resolveViewer() {
  try {
    return await requirePortalSession({ redirectOnMissingAuth: false });
  } catch {
    return requireAdminSession(undefined, { redirectOnMissingAuth: false });
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ receiptId: string }> },
) {
  let viewer: Awaited<ReturnType<typeof resolveViewer>>;
  try {
    viewer = await resolveViewer();
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  try {
    const { receiptId } = await params;
    const receipt = await getReceiptForViewer(viewer, receiptId);
    const html = renderReceiptHtml(receipt);

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${receipt.receiptNumber}.html"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.toLowerCase().includes("access") || message.toLowerCase().includes("permission") || message.toLowerCase().includes("denied")) {
      return fail("Access denied.", 403);
    }
    return fail("Receipt not found.", 404);
  }
}
