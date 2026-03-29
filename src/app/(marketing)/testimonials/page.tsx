import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Card } from "@/components/ui/card";
import { getPublicCmsContext, getPublicTestimonials } from "@/modules/cms/queries";

export default async function TestimonialsPage() {
  const tenant = await getPublicCmsContext();
  const testimonials = await getPublicTestimonials(tenant);

  return (
    <Container className="space-y-10 py-16">
      <SectionHeading
        eyebrow="Testimonials"
        title="Clients remember how clearly you ran the process."
        description="The strongest social proof is not only beautiful projects, but calm execution and visible progress."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        {testimonials.map((testimonial) => (
          <Card key={testimonial.fullName} className="p-8">
            <p className="text-base leading-8 text-[var(--ink-700)]">
              &ldquo;{testimonial.quote}&rdquo;
            </p>
            <div className="mt-6 text-sm font-semibold text-[var(--ink-950)]">
              {testimonial.fullName}
            </div>
            <div className="text-sm text-[var(--ink-500)]">{testimonial.role}</div>
          </Card>
        ))}
      </div>
    </Container>
  );
}
