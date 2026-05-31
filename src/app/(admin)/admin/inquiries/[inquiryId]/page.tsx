import Link from "next/link";
import { notFound } from "next/navigation";

import { InquiryReplyForm } from "@/components/admin/inquiry-reply-form";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { Card } from "@/components/ui/card";
import { requireAdminSession } from "@/lib/auth/guards";
import { getInquiryDetailForAdmin } from "@/modules/inquiries/service";

export default async function AdminInquiryDetailPage({
  params,
}: {
  params: Promise<{ inquiryId: string }>;
}) {
  const tenant = await requireAdminSession();
  const { inquiryId } = await params;
  const inquiry = await getInquiryDetailForAdmin(tenant, inquiryId);

  if (!inquiry) {
    notFound();
  }

  return (
    <DashboardShell
      area="admin"
      title="Inquiry detail"
      subtitle="Read the buyer message, review replies, and send portal-visible updates."
    >
      <div className="space-y-5">
        <Link href="/admin/leads" className="text-sm font-semibold text-[var(--brand-700)]">
          Back to leads
        </Link>

        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-[var(--ink-950)]">{inquiry.fullName}</h2>
              <p className="mt-2 text-sm text-[var(--ink-500)]">
                {inquiry.email}
                {inquiry.phone ? ` - ${inquiry.phone}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-[var(--sand-100)] px-3 py-1 text-xs font-semibold text-[var(--ink-700)]">
                {inquiry.status.replaceAll("_", " ")}
              </span>
              <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--ink-500)]">
                {inquiry.source.replaceAll("_", " ")}
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-[var(--radius-md)] border border-[var(--line)] p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--ink-400)]">Property</div>
              <div className="mt-2 text-sm font-semibold text-[var(--ink-900)]">{inquiry.propertyTitle}</div>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--line)] p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--ink-400)]">Received</div>
              <div className="mt-2 text-sm font-semibold text-[var(--ink-900)]">
                {new Date(inquiry.createdAt).toLocaleString()}
              </div>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--line)] p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--ink-400)]">Internal notes</div>
              <div className="mt-2 text-sm font-semibold text-[var(--ink-900)]">{inquiry.notes ?? "No notes yet"}</div>
            </div>
          </div>

          <div className="mt-6 rounded-[var(--radius-lg)] bg-[var(--sand-50)] p-5">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--ink-400)]">Buyer message</div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--ink-700)]">{inquiry.message}</p>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-[var(--ink-950)]">Replies</h3>
          <div className="mt-4 space-y-3">
            {inquiry.replies.length > 0 ? (
              inquiry.replies.map((reply) => (
                <div key={reply.id} className="rounded-[var(--radius-md)] border border-[var(--line)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--ink-500)]">
                    <span className="font-semibold text-[var(--ink-700)]">{reply.authorName}</span>
                    <span>{new Date(reply.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--ink-700)]">{reply.message}</p>
                </div>
              ))
            ) : (
              <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--line)] p-4 text-sm text-[var(--ink-500)]">
                No replies have been sent yet.
              </p>
            )}
          </div>

          <div className="mt-6 border-t border-[var(--line)] pt-5">
            <InquiryReplyForm inquiryId={inquiry.id} />
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
