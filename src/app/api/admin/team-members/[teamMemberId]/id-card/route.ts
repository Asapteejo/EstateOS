import { requireAdminSession } from "@/lib/auth/guards";
import { getStaffIdCardPayload, renderStaffIdCardHtml } from "@/modules/team/id-card";

export async function GET(
  _request: Request,
  { params }: { params: Promise<unknown> },
) {
  try {
    const tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
    const { teamMemberId } = (await params) as { teamMemberId: string };
    const payload = await getStaffIdCardPayload(tenant, teamMemberId);
    const html = renderStaffIdCardHtml(payload);

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${payload.fullName.replace(/\s+/g, "-").toLowerCase()}-id-card.html"`,
      },
    });
  } catch {
    return new Response("Staff ID card unavailable.", { status: 404 });
  }
}
