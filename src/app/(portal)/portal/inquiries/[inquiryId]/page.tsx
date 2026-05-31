import Link from "next/link";
import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/portal/dashboard-shell";
import { Card } from "@/components/ui/card";
import { requirePortalSession } from "@/lib/auth/guards";
import { getAppSession } from "@/lib/auth/session";
import { getInquiryDetailForBuyer } from "@/modules/inquiries/service";
import { resolveBuyerTenantContextForKyc } from "@/modules/kyc/buyer-user";

export default async function PortalInquiryDetailPage({
  params,
}: {
  params: Promise<{ inquiryId: string }>;
}) {
  const tenant = await requirePortalSession();
  const appSession = await getAppSession("portal");
  const buyerTenant = await resolveBuyerTenantContextForKyc(tenant, {
    email: appSession?.email,
  }).catch(() => tenant);
  const { inquiryId } = await params;
  const inquiry = await getInquiryDetailForBuyer(buyerTenant, inquiryId);

  if (!inquiry) {
    notFound();
  }

  return (
    <DashboardShell
      area="portal"
      title="Inquiry update"
      subtitle="Read your inquiry and replies from the sales team."
    >
      <div className="space-y-5">
        <Link href="/portal/notifications" className="text-sm font-semibold text-[var(--brand-700)]">
          Back to notifications
        </Link>

        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-[var(--ink-950)]">{inquiry.propertyTitle}</h2>
              <p className="mt-2 text-sm text-[var(--ink-500)]">
                Submitted {new Date(inquiry.createdAt).toLocaleString()}
              </p>
            </div>
            <span className="rounded-full bg-[var(--sand-100)] px-3 py-1 text-xs font-semibold text-[var(--ink-700)]">
              {inquiry.status.replaceAll("_", " ")}
            </span>
          </div>

          <div className="mt-6 rounded-[var(--radius-lg)] bg-[var(--sand-50)] p-5">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--ink-400)]">Your message</div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--ink-700)]">{inquiry.message}</p>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-[var(--ink-950)]">Sales team replies</h3>
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
                No replies yet. New replies will also appear in your portal notifications.
              </p>
            )}
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
