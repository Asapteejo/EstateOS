import Link from "next/link";

import { TestimonialSubmissionForm } from "@/components/portal/testimonial-submission-form";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { Card } from "@/components/ui/card";
import { requirePortalSession } from "@/lib/auth/guards";
import { getAppSession } from "@/lib/auth/session";
import {
  getBuyerTestimonialPropertyOptions,
  getBuyerTestimonials,
} from "@/modules/testimonials/service";

export default async function PortalTestimonialsPage() {
  const tenant = await requirePortalSession();
  const session = await getAppSession("portal");
  const [testimonials, propertyOptions] = await Promise.all([
    getBuyerTestimonials(tenant, { email: session?.email }),
    getBuyerTestimonialPropertyOptions(tenant, { email: session?.email }),
  ]);

  return (
    <DashboardShell
      area="portal"
      title="Testimonials"
      subtitle="Share a reviewed testimonial that helps future buyers trust this company."
    >
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-[var(--ink-950)]">Write a testimonial</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-500)]">
            Your testimonial helps future buyers trust this company. It will be reviewed before publishing.
          </p>
          <div className="mt-5">
            <TestimonialSubmissionForm properties={propertyOptions} />
          </div>
        </Card>

        <div className="space-y-4">
          {testimonials.length > 0 ? (
            testimonials.map((testimonial) => (
              <Card key={testimonial.id} className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-amber-500">
                      {"★".repeat(testimonial.rating)}{"☆".repeat(5 - testimonial.rating)}
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-[var(--ink-950)]">
                      {testimonial.title ?? "Untitled testimonial"}
                    </h3>
                    <p className="mt-1 text-sm text-[var(--ink-500)]">
                      {testimonial.propertyTitle ?? "Company testimonial"}
                    </p>
                  </div>
                  <span className="rounded-full border border-[var(--line)] bg-[var(--sand-50)] px-3 py-1 text-xs font-semibold text-[var(--ink-700)]">
                    {testimonial.statusLabel}
                  </span>
                </div>
                <p className="mt-4 line-clamp-3 text-sm leading-7 text-[var(--ink-700)]">{testimonial.quote}</p>
                {testimonial.rejectionReason ? (
                  <p className="mt-3 rounded-[var(--radius-md)] bg-rose-50 p-3 text-sm text-rose-700">
                    {testimonial.rejectionReason}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--ink-500)]">
                  <span>Submitted {testimonial.submittedAt}</span>
                  <Link href={`/portal/testimonials/${testimonial.id}`} className="font-semibold text-[var(--brand-700)]">
                    View
                  </Link>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-8 text-center">
              <h3 className="text-lg font-semibold text-[var(--ink-950)]">No testimonials yet</h3>
              <p className="mt-2 text-sm text-[var(--ink-500)]">
                Once you send one, its review status and any moderation feedback will appear here.
              </p>
            </Card>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
