import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Card } from "@/components/ui/card";
import { getPublicCmsContext, getPublicFaqs } from "@/modules/cms/queries";

export default async function FaqPage() {
  const tenant = await getPublicCmsContext();
  const faqs = await getPublicFaqs(tenant);

  return (
    <Container className="space-y-10 py-16">
      <SectionHeading
        eyebrow="FAQ"
        title="Clear answers for the points that usually create friction."
        description="This foundation bakes trust into payments, documents, reservation windows, and transaction visibility."
      />
      <div className="space-y-4">
        {faqs.map((faq) => (
          <Card key={faq.question} className="p-6">
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--ink-500)]">
              {faq.category}
            </div>
            <h3 className="mt-2 text-xl font-semibold text-[var(--ink-950)]">{faq.question}</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-600)]">{faq.answer}</p>
          </Card>
        ))}
      </div>
    </Container>
  );
}
