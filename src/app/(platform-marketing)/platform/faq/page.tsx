import { ChevronDown } from "lucide-react";

import { Container } from "@/components/shared/container";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeading } from "@/components/shared/section-heading";
import { Card } from "@/components/ui/card";
import { platformFaqs } from "@/modules/platform-site/content";

export default function PlatformFaqPage() {
  return (
    <div className="py-16">
      <Container className="max-w-3xl space-y-10">
        <Reveal>
          <SectionHeading
            eyebrow="FAQ"
            title="Straight answers for operators evaluating EstateOS."
            description="The platform site should explain the product honestly, including what is live today and what is architecturally ready for later activation."
          />
        </Reveal>
        <div className="space-y-4">
          {platformFaqs.map((faq, index) => (
            <Reveal key={faq.question} delay={index * 0.05}>
              <Card className="overflow-hidden p-0">
                <details className="group">
                  <summary className="admin-focus flex cursor-pointer list-none items-center justify-between gap-4 p-6 text-left [&::-webkit-details-marker]:hidden">
                    <h2 className="text-lg font-semibold text-[var(--ink-950)]">{faq.question}</h2>
                    <ChevronDown
                      className="h-5 w-5 shrink-0 text-[var(--ink-500)] transition-transform duration-200 group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <p className="px-6 pb-6 text-sm leading-7 text-[var(--ink-600)]">{faq.answer}</p>
                </details>
              </Card>
            </Reveal>
          ))}
        </div>
      </Container>
    </div>
  );
}
