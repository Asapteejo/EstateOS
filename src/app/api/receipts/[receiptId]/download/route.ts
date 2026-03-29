import { requireAdminSession, requirePortalSession } from "@/lib/auth/guards";
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
  try {
    const viewer = await resolveViewer();
    const { receiptId } = await params;
    const receipt = await getReceiptForViewer(viewer, receiptId);
    const html = renderReceiptHtml(receipt);

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${receipt.receiptNumber}.html"`,
      },
    });
  } catch {
    return new Response("Receipt unavailable.", { status: 404 });
  }
}
