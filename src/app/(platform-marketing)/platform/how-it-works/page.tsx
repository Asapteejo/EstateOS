import { Building2, ShieldCheck, Users, type LucideIcon } from "lucide-react";

import { Container } from "@/components/shared/container";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeading } from "@/components/shared/section-heading";
import { Card } from "@/components/ui/card";
import { platformHowItWorks } from "@/modules/platform-site/content";

const STEP_ICONS: Record<string, LucideIcon> = {
  building: Building2,
  users: Users,
  shield: ShieldCheck,
};

export default function PlatformHowItWorksPage() {
  return (
    <div className="py-16">
      <Container className="space-y-10">
        <Reveal>
          <SectionHeading
            eyebrow="How it works"
            title="Operate one SaaS platform across multiple real estate companies."
            description="EstateOS separates platform-owner oversight, tenant-company operations, and buyer-facing transaction visibility so each layer stays clear and safe."
          />
        </Reveal>
        <div className="grid gap-6 lg:grid-cols-3">
          {platformHowItWorks.map((step, index) => {
            const Icon = STEP_ICONS[step.icon] ?? Building2;
            return (
              <Reveal key={step.title} delay={index * 0.06}>
                <Card interactive className="h-full p-8">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ink-950)] text-sm font-semibold text-white">
                      {index + 1}
                    </span>
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--sand-100)] text-[var(--ink-700)]">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                  </div>
                  <h2 className="mt-5 text-xl font-semibold text-[var(--ink-950)]">{step.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-[var(--ink-600)]">{step.body}</p>
                </Card>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </div>
  );
}
