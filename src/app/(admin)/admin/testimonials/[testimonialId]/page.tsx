import Link from "next/link";
import { notFound } from "next/navigation";

import { TestimonialModerationActions } from "@/components/admin/testimonial-moderation-actions";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { Card } from "@/components/ui/card";
import { requireAdminSession } from "@/lib/auth/guards";
import { getAdminTestimonialDetail } from "@/modules/testimonials/service";

export default async function AdminTestimonialDetailPage({
  params,
}: {
  params: Promise<{ testimonialId: string }>;
}) {
  const tenant = await requireAdminSession(["ADMIN"]);
  const { testimonialId } = await params;
  const testimonial = await getAdminTestimonialDetail(tenant, testimonialId);

  if (!testimonial) {
    notFound();
  }

  return (
    <DashboardShell
      area="admin"
      title="Review testimonial"
      subtitle="Approve, reject, publish, unpublish, or delete a tenant-scoped testimonial."
    >
      <div className="space-y-5">
        <Link href="/admin/testimonials" className="text-sm font-semibold text-[var(--brand-700)]">
          Back to testimonials
        </Link>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[var(--sand-100)] text-sm font-semibold text-[var(--ink-700)]">
                  {testimonial.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={testimonial.avatarUrl} alt={`${testimonial.displayName} avatar`} width={48} height={48} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  ) : (
                    testimonial.displayName.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-[var(--ink-950)]">{testimonial.displayName}</h2>
                  <p className="text-sm text-[var(--ink-500)]">{testimonial.buyerEmail ?? testimonial.source}</p>
                </div>
              </div>
              <span className="rounded-full bg-[var(--sand-100)] px-3 py-1 text-xs font-semibold text-[var(--ink-700)]">
                {testimonial.statusLabel}
              </span>
            </div>
            <div className="mt-6 text-sm font-semibold text-amber-500">
              {"★".repeat(testimonial.rating)}{"☆".repeat(5 - testimonial.rating)}
            </div>
            {testimonial.title ? (
              <h3 className="mt-3 text-lg font-semibold text-[var(--ink-950)]">{testimonial.title}</h3>
            ) : null}
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--ink-700)]">{testimonial.quote}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--ink-500)]">
                {testimonial.propertyTitle ?? "Company testimonial"}
              </span>
              {testimonial.isVerifiedBuyer ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Verified buyer
                </span>
              ) : null}
            </div>
            {testimonial.rejectionReason ? (
              <div className="mt-5 rounded-[var(--radius-md)] bg-rose-50 p-4 text-sm text-rose-700">
                <div className="font-semibold">Rejection reason</div>
                <p className="mt-1">{testimonial.rejectionReason}</p>
              </div>
            ) : null}
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-[var(--ink-950)]">Moderation</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-500)]">
              Published testimonials appear on the tenant public site. Rejections require a reason and notify the buyer.
            </p>
            <div className="mt-5">
              <TestimonialModerationActions testimonialId={testimonial.id} status={testimonial.status} />
            </div>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
