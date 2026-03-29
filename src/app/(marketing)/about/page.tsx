import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Card } from "@/components/ui/card";

export default function AboutPage() {
  return (
    <Container className="space-y-10 py-16">
      <SectionHeading
        eyebrow="About"
        title="Built for serious property companies that want trust to scale."
        description="This foundation treats the website, buyer portal, and internal operations layer as one product system."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        {["Clarity", "Speed", "Accountability"].map((item) => (
          <Card key={item} className="p-8">
            <h3 className="text-2xl font-semibold text-[var(--ink-950)]">{item}</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-600)]">
              The platform keeps listing discovery, transaction progress, payments,
              documents, and staff actions visible and structured.
            </p>
          </Card>
        ))}
      </div>
    </Container>
  );
}
