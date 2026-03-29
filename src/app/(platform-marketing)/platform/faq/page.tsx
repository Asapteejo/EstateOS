import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Card } from "@/components/ui/card";
import { platformFaqs } from "@/modules/platform-site/content";

export default function PlatformFaqPage() {
  return (
    <div className="py-16">
      <Container className="space-y-10">
        <SectionHeading
          eyebrow="FAQ"
          title="Straight answers for operators evaluating EstateOS."
          description="The platform site should explain the product honestly, including what is live today and what is architecturally ready for later activation."
        />
        <div className="space-y-4">
          {platformFaqs.map((faq) => (
            <Card key={faq.question} className="p-8">
              <h2 className="text-xl font-semibold text-[var(--ink-950)]">{faq.question}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-600)]">{faq.answer}</p>
            </Card>
          ))}
        </div>
      </Container>
    </div>
  );
}
