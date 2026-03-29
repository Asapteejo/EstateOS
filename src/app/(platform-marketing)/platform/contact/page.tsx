import Link from "next/link";

import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function PlatformContactPage() {
  return (
    <div className="py-16">
      <Container className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card className="p-8 sm:p-10">
          <SectionHeading
            eyebrow="Request a demo"
            title="Talk to the EstateOS team about launching a pilot."
            description="Use this platform contact surface for SaaS evaluation, pricing, rollout planning, and platform-owner questions. Tenant property inquiries should still go through the tenant public site contact flow."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              "Tenant onboarding strategy",
              "Billing and commission model",
              "Buyer portal and transaction workflow",
              "Platform-owner reporting and payout readiness",
            ].map((item) => (
              <div
                key={item}
                className="rounded-3xl border border-[var(--line)] bg-[var(--sand-50)] p-5 text-sm font-medium text-[var(--ink-700)]"
              >
                {item}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-8 sm:p-10">
          <div className="text-sm uppercase tracking-[0.2em] text-[var(--ink-500)]">Next step</div>
          <h2 className="mt-3 font-serif text-3xl text-[var(--ink-950)]">Start with a guided pilot conversation.</h2>
          <p className="mt-4 text-sm leading-7 text-[var(--ink-600)]">
            EstateOS is structured for multi-tenant rollout, company-level billing, and
            commission-aware transaction processing. The quickest path is to align plan,
            payout, and launch expectations before enabling live providers.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="mailto:hello@estateos.app">
              <Button size="lg">hello@estateos.app</Button>
            </Link>
            <Link href="/platform/pricing">
              <Button variant="outline" size="lg">
                Review pricing
              </Button>
            </Link>
          </div>
        </Card>
      </Container>
    </div>
  );
}
