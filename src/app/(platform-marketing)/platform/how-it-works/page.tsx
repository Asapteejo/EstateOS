import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Card } from "@/components/ui/card";
import { platformHowItWorks } from "@/modules/platform-site/content";

export default function PlatformHowItWorksPage() {
  return (
    <div className="py-16">
      <Container className="space-y-10">
        <SectionHeading
          eyebrow="How it works"
          title="Operate one SaaS platform across multiple real estate companies."
          description="EstateOS separates platform-owner oversight, tenant-company operations, and buyer-facing transaction visibility so each layer stays clear and safe."
        />
        <div className="grid gap-6 lg:grid-cols-3">
          {platformHowItWorks.map((step, index) => (
            <Card key={step.title} className="p-8">
              <div className="text-sm uppercase tracking-[0.18em] text-[var(--ink-500)]">
                Step {index + 1}
              </div>
              <h2 className="mt-4 text-2xl font-semibold text-[var(--ink-950)]">{step.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-600)]">{step.body}</p>
            </Card>
          ))}
        </div>
      </Container>
    </div>
  );
}
