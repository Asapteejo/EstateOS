import { PlatformPricing } from "@/components/platform/platform-pricing";
import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Card } from "@/components/ui/card";
import { getPlatformPricingPlans } from "@/modules/platform-site/content";

export const dynamic = "force-dynamic";

export default async function PlatformPricingPage() {
  const plans = await getPlatformPricingPlans();

  return (
    <div className="py-16">
      <Container className="space-y-10">
        <SectionHeading
          eyebrow="Pricing"
          title="Hybrid SaaS pricing for real estate operators."
          description="EstateOS combines monthly or annual plan access with transaction commission on successful property payments. Manually granted plans remain commissionable."
        />

        <PlatformPricing plans={plans} />

        <Card className="grid gap-5 p-8 lg:grid-cols-3">
          {[
            "Successful property payments generate EstateOS platform commission regardless of paid or granted plan state.",
            "Split-settlement architecture is provider-aware so tenant proceeds and platform commission can be separated safely.",
            "International provider readiness is architectural today; only live providers should be marketed as active in production.",
          ].map((point) => (
            <div
              key={point}
              className="rounded-3xl bg-[var(--sand-50)] p-5 text-sm leading-7 text-[var(--ink-700)]"
            >
              {point}
            </div>
          ))}
        </Card>
      </Container>
    </div>
  );
}
