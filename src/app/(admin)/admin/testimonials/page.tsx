import Link from "next/link";

import { DashboardShell } from "@/components/portal/dashboard-shell";
import { Card } from "@/components/ui/card";
import { requireAdminSession } from "@/lib/auth/guards";
import { getAdminTestimonials, testimonialStatusLabels } from "@/modules/testimonials/service";

export default async function AdminTestimonialsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tenant = await requireAdminSession(["ADMIN"]);
  const params = (await searchParams) ?? {};
  const filters = {
    status: typeof params.status === "string" ? params.status : undefined,
    rating: typeof params.rating === "string" ? Number(params.rating) : undefined,
    propertyId: typeof params.propertyId === "string" ? params.propertyId : undefined,
    q: typeof params.q === "string" ? params.q : undefined,
  };
  const testimonials = await getAdminTestimonials(tenant, filters);

  return (
    <DashboardShell
      area="admin"
      title="Testimonials"
      subtitle="Review buyer-submitted testimonials before they appear on the public tenant site."
    >
      <div className="space-y-5">
        <form className="grid gap-3 rounded-[var(--radius-xl)] border border-[var(--line)] bg-white/80 p-4 md:grid-cols-[1.4fr_1fr_1fr_auto]">
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Search testimonials"
            className="admin-focus rounded-[var(--radius-md)] border border-[var(--line)] px-3 py-2 text-sm"
          />
          <select name="status" defaultValue={filters.status} className="admin-focus rounded-[var(--radius-md)] border border-[var(--line)] px-3 py-2 text-sm">
            <option value="">All statuses</option>
            {Object.entries(testimonialStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select name="rating" defaultValue={filters.rating} className="admin-focus rounded-[var(--radius-md)] border border-[var(--line)] px-3 py-2 text-sm">
            <option value="">Any rating</option>
            {[5, 4, 3, 2, 1].map((rating) => (
              <option key={rating} value={rating}>
                {rating} stars
              </option>
            ))}
          </select>
          <button className="admin-interactive admin-focus rounded-full bg-[var(--brand-700)] px-5 py-2 text-sm font-semibold text-white" type="submit">
            Filter
          </button>
        </form>

        <div className="grid gap-4">
          {testimonials.length > 0 ? (
            testimonials.map((testimonial) => (
              <Card key={testimonial.id} className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-amber-500">
                      {"★".repeat(testimonial.rating)}{"☆".repeat(5 - testimonial.rating)}
                    </div>
                    <h2 className="mt-2 text-xl font-semibold text-[var(--ink-950)]">
                      {testimonial.title ?? "Untitled testimonial"}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--ink-500)]">
                      {testimonial.displayName} {testimonial.buyerEmail ? `- ${testimonial.buyerEmail}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-[var(--sand-100)] px-3 py-1 text-xs font-semibold text-[var(--ink-700)]">
                      {testimonial.statusLabel}
                    </span>
                    {testimonial.isVerifiedBuyer ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        Verified buyer
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="mt-4 line-clamp-3 text-sm leading-7 text-[var(--ink-700)]">{testimonial.quote}</p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--ink-500)]">
                  <span>{testimonial.propertyTitle ?? "Company testimonial"} - {testimonial.submittedAt}</span>
                  <Link href={`/admin/testimonials/${testimonial.id}`} className="font-semibold text-[var(--brand-700)]">
                    Review
                  </Link>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-8 text-center">
              <h3 className="text-lg font-semibold text-[var(--ink-950)]">No testimonials found</h3>
              <p className="mt-2 text-sm text-[var(--ink-500)]">
                Buyer submissions and seeded testimonials matching your filters will appear here.
              </p>
            </Card>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
