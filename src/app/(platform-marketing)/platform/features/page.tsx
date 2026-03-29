import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Card } from "@/components/ui/card";
import { platformFeatures } from "@/modules/platform-site/content";

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
          {platformFeatures.map((feature) => (
            <Card key={feature.title} className="p-8">
              <h2 className="text-2xl font-semibold text-[var(--ink-950)]">{feature.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-600)]">{feature.body}</p>
            </Card>
          ))}
        </div>
      </Container>
    </div>
  );
}
