import Link from "next/link";
import { notFound } from "next/navigation";

import { TestimonialSubmissionForm } from "@/components/portal/testimonial-submission-form";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { Card } from "@/components/ui/card";
import { requirePortalSession } from "@/lib/auth/guards";
import { getAppSession } from "@/lib/auth/session";
import {
  getBuyerTestimonialDetail,
  getBuyerTestimonialPropertyOptions,
} from "@/modules/testimonials/service";

export default async function PortalTestimonialDetailPage({
  params,
}: {
  params: Promise<{ testimonialId: string }>;
}) {
  const tenant = await requirePortalSession();
  const session = await getAppSession("portal");
  const { testimonialId } = await params;
  const [testimonial, propertyOptions] = await Promise.all([
    getBuyerTestimonialDetail(tenant, testimonialId, { email: session?.email }),
    getBuyerTestimonialPropertyOptions(tenant, { email: session?.email }),
  ]);

  if (!testimonial) {
    notFound();
  }

  const canResubmit = testimonial.status === "REJECTED" || testimonial.status === "UNPUBLISHED";

  return (
    <DashboardShell
      area="portal"
      title="Testimonial detail"
      subtitle="Review your submitted testimonial and moderation feedback."
    >
      <div className="space-y-5">
        <Link href="/portal/testimonials" className="text-sm font-semibold text-[var(--brand-700)]">
          Back to testimonials
        </Link>

        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-amber-500">
                {"★".repeat(testimonial.rating)}{"☆".repeat(5 - testimonial.rating)}
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-950)]">
                {testimonial.title ?? "Untitled testimonial"}
              </h2>
              <p className="mt-1 text-sm text-[var(--ink-500)]">{testimonial.propertyTitle ?? "Company testimonial"}</p>
            </div>
            <span className="rounded-full border border-[var(--line)] bg-[var(--sand-50)] px-3 py-1 text-xs font-semibold text-[var(--ink-700)]">
              {testimonial.statusLabel}
            </span>
          </div>
          <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-[var(--ink-700)]">{testimonial.quote}</p>
          {testimonial.rejectionReason ? (
            <div className="mt-5 rounded-[var(--radius-md)] bg-rose-50 p-4 text-sm text-rose-700">
              <div className="font-semibold">Moderation feedback</div>
              <p className="mt-1">{testimonial.rejectionReason}</p>
            </div>
          ) : null}
        </Card>

        {canResubmit ? (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-[var(--ink-950)]">Resubmit testimonial</h3>
            <p className="mt-2 text-sm text-[var(--ink-500)]">
              Update the text and send it back for review.
            </p>
            <div className="mt-5">
              <TestimonialSubmissionForm
                properties={propertyOptions}
                endpoint={`/api/portal/testimonials/${testimonial.id}`}
                method="PATCH"
                initial={testimonial}
                submitLabel="Resubmit for review"
              />
            </div>
          </Card>
        ) : null}
      </div>
    </DashboardShell>
  );
}
