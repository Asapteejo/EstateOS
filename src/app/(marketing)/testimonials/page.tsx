import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Card } from "@/components/ui/card";
import { getPublicCmsContext, getPublicTestimonials } from "@/modules/cms/queries";
import { getPublicTestimonialPropertyOptions } from "@/modules/testimonials/service";

export default async function TestimonialsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tenant = await getPublicCmsContext();
  const params = (await searchParams) ?? {};
  const filters = {
    rating: typeof params.rating === "string" ? params.rating : undefined,
    propertyId: typeof params.propertyId === "string" ? params.propertyId : undefined,
    year: typeof params.year === "string" ? params.year : undefined,
    month: typeof params.month === "string" ? params.month : undefined,
    q: typeof params.q === "string" ? params.q : undefined,
  };
  const [testimonials, propertyOptions] = await Promise.all([
    getPublicTestimonials(tenant, filters),
    getPublicTestimonialPropertyOptions(tenant),
  ]);

  return (
    <Container className="space-y-10 py-16">
      <SectionHeading
        eyebrow="Testimonials"
        title="Clients remember how clearly you ran the process."
        description="The strongest social proof is not only beautiful projects, but calm execution and visible progress."
      />

      <form className="grid gap-3 rounded-[var(--radius-xl)] border border-[var(--line)] bg-white/80 p-4 md:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.8fr_auto]">
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="Search testimonials"
          className="admin-focus rounded-[var(--radius-md)] border border-[var(--line)] px-3 py-2 text-sm"
        />
        <select name="propertyId" defaultValue={filters.propertyId} className="admin-focus rounded-[var(--radius-md)] border border-[var(--line)] px-3 py-2 text-sm">
          <option value="">All properties</option>
          {propertyOptions.map((property) => (
            <option key={property.id} value={property.id}>
              {property.title}
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
        <input name="year" defaultValue={filters.year} placeholder="Year" className="admin-focus rounded-[var(--radius-md)] border border-[var(--line)] px-3 py-2 text-sm" />
        <input name="month" defaultValue={filters.month} placeholder="Month" className="admin-focus rounded-[var(--radius-md)] border border-[var(--line)] px-3 py-2 text-sm" />
        <button className="admin-interactive admin-focus rounded-full bg-[var(--brand-700)] px-5 py-2 text-sm font-semibold text-white" type="submit">
          Filter
        </button>
      </form>

      <div className="grid gap-6 lg:grid-cols-3">
        {testimonials.map((testimonial) => (
          <Card key={testimonial.id ?? testimonial.fullName} className="p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[var(--sand-100)] text-sm font-semibold text-[var(--ink-700)]">
                {testimonial.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={testimonial.avatarUrl} alt={`${testimonial.fullName} avatar`} className="h-full w-full object-cover" />
                ) : (
                  testimonial.fullName.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--ink-950)]">{testimonial.fullName}</div>
                <div className="text-xs text-[var(--ink-500)]">{testimonial.propertyTitle ?? testimonial.role}</div>
              </div>
            </div>
            <div className="mt-5 text-sm font-semibold text-amber-500" aria-label={`${testimonial.rating ?? 5} star rating`}>
              {"★".repeat(testimonial.rating ?? 5)}{"☆".repeat(5 - (testimonial.rating ?? 5))}
            </div>
            {testimonial.title ? (
              <div className="mt-3 text-base font-semibold text-[var(--ink-950)]">{testimonial.title}</div>
            ) : null}
            <p className="text-base leading-8 text-[var(--ink-700)]">
              &ldquo;{testimonial.quote}&rdquo;
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {testimonial.isVerifiedBuyer ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Verified buyer
                </span>
              ) : null}
              {testimonial.publishedAt ? (
                <span className="text-xs text-[var(--ink-500)]">{testimonial.publishedAt}</span>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
    </Container>
  );
}
