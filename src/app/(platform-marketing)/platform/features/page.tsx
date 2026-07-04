import { Coins, LayoutDashboard, Layers, Workflow, type LucideIcon } from "lucide-react";

import { Container } from "@/components/shared/container";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeading } from "@/components/shared/section-heading";
import { Card } from "@/components/ui/card";
import { platformFeatures } from "@/modules/platform-site/content";

const FEATURE_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  workflow: Workflow,
  coins: Coins,
  layers: Layers,
};

export default function PlatformFeaturesPage() {
  return (
    <div className="py-16">
      <Container className="space-y-10">
        <SectionHeading
          eyebrow="Features"
          title="EstateOS combines public discovery, company operations, and transaction control."
          description="This is the SaaS layer for real estate companies, not a tenant listing site. Each feature area is designed to connect marketing, CRM, buyer portal, and payment workflow cleanly."
        />
        <div className="grid gap-6 lg:grid-cols-2">
          {platformFeatures.map((feature, index) => {
            const Icon = FEATURE_ICONS[feature.icon] ?? LayoutDashboard;
            return (
              <Reveal key={feature.title} delay={index * 0.06}>
                <Card interactive className="h-full p-8">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--brand-100,#dcfce7)] text-[var(--brand-700)]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h2 className="mt-5 text-xl font-semibold text-[var(--ink-950)]">{feature.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-[var(--ink-600)]">{feature.body}</p>
                </Card>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </div>
  );
}
