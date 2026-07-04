import { ChevronDown } from "lucide-react";

import { Container } from "@/components/shared/container";
import { EmptyState } from "@/components/shared/empty-state";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeading } from "@/components/shared/section-heading";
import { getPublicCmsContext, getPublicFaqs } from "@/modules/cms/queries";
import type { FaqItem } from "@/types/domain";

export default async function FaqPage() {
  const tenant = await getPublicCmsContext();
  const faqs = await getPublicFaqs(tenant);

  const groups = new Map<string, FaqItem[]>();
  for (const faq of faqs) {
    const category = faq.category ?? "General";
    const list = groups.get(category) ?? [];
    list.push(faq);
    groups.set(category, list);
  }

  return (
    <Container className="space-y-10 py-16">
      <Reveal>
        <SectionHeading
          eyebrow="FAQ"
          title="Clear answers for the questions that usually create friction."
          description="Everything buyers ask about payments, documents, reservations, and how the process stays visible from first inquiry to final receipt."
        />
      </Reveal>

      {faqs.length === 0 ? (
        <EmptyState
          title="No questions published yet"
          description="Frequently asked questions will appear here once the team adds them."
        />
      ) : (
        <div className="space-y-10">
          {[...groups.entries()].map(([category, items]) => (
            <Reveal key={category} className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)]">
                {category}
              </h2>
              <div className="divide-y divide-[var(--line)] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--line)] bg-white/80">
                {items.map((faq) => (
                  <details key={faq.question} className="group">
                    <summary className="admin-focus flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left [&::-webkit-details-marker]:hidden">
                      <span className="text-base font-semibold text-[var(--ink-950)]">
                        {faq.question}
                      </span>
                      <ChevronDown
                        className="h-5 w-5 shrink-0 text-[var(--ink-400)] transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                        aria-hidden
                      />
                    </summary>
                    <div className="px-5 pb-5 text-sm leading-7 text-[var(--ink-600)]">
                      {faq.answer}
                    </div>
                  </details>
                ))}
              </div>
            </Reveal>
          ))}
        </div>
      )}
    </Container>
  );
}
