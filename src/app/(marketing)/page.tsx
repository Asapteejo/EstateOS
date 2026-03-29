import Link from "next/link";

import { PropertyCard } from "@/components/marketing/property-card";
import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getPublicBlogPosts,
  getPublicCmsContext,
  getPublicTestimonials,
} from "@/modules/cms/queries";
import { properties } from "@/modules/properties/demo-data";

export default async function HomePage() {
  const tenant = await getPublicCmsContext();
  const [testimonials, blogPosts] = await Promise.all([
    getPublicTestimonials(tenant),
    getPublicBlogPosts(tenant),
  ]);

  return (
    <div className="space-y-24 pb-24">
      <section className="pt-12">
        <Container>
          <Card className="overflow-hidden bg-[linear-gradient(135deg,#08151c,#0e5b49_48%,#d3c1a1_140%)] px-8 py-14 text-white sm:px-14 sm:py-20">
            <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-8">
                <Badge className="bg-white/12 text-white">Website + CRM + Transaction Engine</Badge>
                <div className="space-y-5">
                  <h1 className="max-w-3xl font-serif text-5xl leading-none sm:text-7xl">
                    Premium property experiences backed by operational trust.
                  </h1>
                  <p className="max-w-2xl text-lg leading-8 text-white/78">
                    Discover inventory, reserve units, make verified payments, upload
                    documents, and track every milestone in one calm, production-ready platform.
                  </p>
                </div>
                <div className="flex flex-wrap gap-4">
                  <Link href="/properties">
                    <Button size="lg">Browse properties</Button>
                  </Link>
                  <Link href="/portal">
                    <Button variant="secondary" size="lg">
                      Enter buyer portal
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ["₦1.84B", "Pipeline sales value"],
                  ["96%", "Document completion rate"],
                  ["14m", "Median inquiry response"],
                  ["18", "Active transaction milestones"],
                ].map(([value, label]) => (
                  <Card key={label} className="bg-white/8 p-6 text-white backdrop-blur">
                    <div className="text-3xl font-semibold">{value}</div>
                    <div className="mt-2 text-sm text-white/70">{label}</div>
                  </Card>
                ))}
              </div>
            </div>
          </Card>
        </Container>
      </section>

      <section>
        <Container className="space-y-10">
          <SectionHeading
            eyebrow="Featured Inventory"
            title="Curated listings that feel credible from the first click."
            description="Each property page combines media, location context, payment planning, trust signals, and direct conversion pathways."
          />
          <div className="grid gap-6 lg:grid-cols-3">
            {properties.filter((property) => property.featured).map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        </Container>
      </section>

      <section>
        <Container className="grid gap-6 lg:grid-cols-3">
          {[
            {
              title: "Discover with confidence",
              body: "Search listings by location, budget, status, and payment-plan fit with premium detail pages built to convert.",
            },
            {
              title: "Transact without chaos",
              body: "Reservation, payments, receipts, documents, and milestone updates stay visible in one buyer-facing workspace.",
            },
            {
              title: "Operate like a serious company",
              body: "Staff have listings, leads, documents, payments, and auditability in one internal system from day one.",
            },
          ].map((item) => (
            <Card key={item.title} className="p-8">
              <h3 className="text-2xl font-semibold text-[var(--ink-950)]">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-600)]">{item.body}</p>
            </Card>
          ))}
        </Container>
      </section>

      <section>
        <Container className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card className="p-8 sm:p-10">
            <SectionHeading
              eyebrow="Trust Layer"
              title="The product goes beyond a brochure."
              description="Buyers need a system that makes progress visible and staff need tools that reduce operational leakage."
            />
          </Card>
          <Card className="grid gap-6 p-8 sm:grid-cols-2 sm:p-10">
            {[
              "Server-side payment verification",
              "Private document access patterns",
              "Role-aware route protection",
              "Audit logs for staff actions",
              "Email + in-app notifications",
              "Future-ready multi-branch schema",
            ].map((point) => (
              <div key={point} className="rounded-3xl bg-[var(--sand-100)] p-5 text-sm font-medium text-[var(--ink-700)]">
                {point}
              </div>
            ))}
          </Card>
        </Container>
      </section>

      <section>
        <Container className="space-y-10">
          <SectionHeading
            eyebrow="Client Proof"
            title="A platform that lowers anxiety throughout the purchase cycle."
            description="Trust compounds when clients can see what changed, what was paid, which document was received, and what happens next."
          />
          <div className="grid gap-6 lg:grid-cols-3">
            {testimonials.map((testimonial) => (
              <Card key={testimonial.fullName} className="p-8">
                <p className="text-base leading-8 text-[var(--ink-700)]">“{testimonial.quote}”</p>
                <div className="mt-6 text-sm font-semibold text-[var(--ink-950)]">
                  {testimonial.fullName}
                </div>
                <div className="text-sm text-[var(--ink-500)]">
                  {testimonial.role}
                  {testimonial.company ? `, ${testimonial.company}` : ""}
                </div>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      <section>
        <Container className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <Card className="p-8 sm:p-10">
            <SectionHeading
              eyebrow="Insights"
              title="Real estate intelligence for modern operators and buyers."
              description="The CMS foundation supports thought leadership, project education, and trust-building content."
            />
          </Card>
          <div className="space-y-4">
            {blogPosts.map((post) => (
              <Card key={post.slug} className="p-6">
                <div className="text-sm text-[var(--ink-500)]">{post.publishedAt}</div>
                <h3 className="mt-2 text-2xl font-semibold text-[var(--ink-950)]">
                  <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                </h3>
                <p className="mt-2 text-sm leading-7 text-[var(--ink-600)]">{post.excerpt}</p>
              </Card>
            ))}
          </div>
        </Container>
      </section>
    </div>
  );
}
