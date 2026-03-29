import Link from "next/link";

import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getPlatformPricingPlans,
  platformFeatures,
  platformHowItWorks,
  platformWhyEstateOS,
} from "@/modules/platform-site/content";
import { formatCurrency } from "@/lib/utils";

export async function PlatformHome() {
  const plans = await getPlatformPricingPlans();

  return (
    <div className="space-y-24 pb-24">
      <section className="pt-12">
        <Container>
          <Card className="overflow-hidden bg-[linear-gradient(135deg,#07131a,#0b3e4f_48%,#d7b98f_140%)] px-8 py-14 text-white sm:px-14 sm:py-20">
            <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-8">
                <Badge className="bg-white/12 text-white">Platform owner + tenant operations</Badge>
                <div className="space-y-5">
                  <h1 className="max-w-3xl font-serif text-5xl leading-none sm:text-7xl">
                    The real estate SaaS behind listings, CRM, payments, and buyer trust.
                  </h1>
                  <p className="max-w-2xl text-lg leading-8 text-white/80">
                    EstateOS gives real estate companies one operating system for public
                    listings, inquiries, reservations, document workflows, buyer portal
                    updates, and commission-aware payment operations.
                  </p>
                </div>
                <div className="flex flex-wrap gap-4">
                  <Link href="/platform/contact">
                    <Button size="lg">Request a demo</Button>
                  </Link>
                  <Link href="/platform/pricing">
                    <Button variant="secondary" size="lg">
                      See pricing
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ["Multi-tenant", "Separate platform-owner, tenant admin, buyer, and public experiences cleanly."],
                  ["Hybrid revenue", "Monthly or annual plans plus transaction commission on successful payments."],
                  ["Platform control", "Superadmin visibility across subscriptions, payouts, audits, and payment events."],
                  ["Global-ready", "Provider-aware payment architecture for local and international expansion."],
                ].map(([title, body]) => (
                  <Card key={title} className="bg-white/8 p-6 text-white backdrop-blur">
                    <div className="text-lg font-semibold">{title}</div>
                    <div className="mt-2 text-sm leading-7 text-white/72">{body}</div>
                  </Card>
                ))}
              </div>
            </div>
          </Card>
        </Container>
      </section>

      <section>
        <Container className="space-y-10">
          <SectionHeading
            eyebrow="Core platform"
            title="Built for real estate operators who need more than a brochure website."
            description="EstateOS combines company-level operations, buyer transaction visibility, and platform-level monetization controls in one architecture."
          />
          <div className="grid gap-6 lg:grid-cols-2">
            {platformFeatures.map((feature) => (
              <Card key={feature.title} className="p-8">
                <h3 className="text-2xl font-semibold text-[var(--ink-950)]">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-600)]">{feature.body}</p>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      <section>
        <Container className="grid gap-6 lg:grid-cols-3">
          {platformHowItWorks.map((step, index) => (
            <Card key={step.title} className="p-8">
              <div className="text-sm uppercase tracking-[0.18em] text-[var(--ink-500)]">
                Step {index + 1}
              </div>
              <h3 className="mt-4 text-2xl font-semibold text-[var(--ink-950)]">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-600)]">{step.body}</p>
            </Card>
          ))}
        </Container>
      </section>

      <section>
        <Container className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card className="p-8 sm:p-10">
            <SectionHeading
              eyebrow="Why EstateOS"
              title="A cleaner split between platform owner, tenant company, and buyer experience."
              description="The product is designed so the SaaS operator can see platform-wide monetization and company health without weakening tenant isolation for normal users."
            />
          </Card>
          <Card className="grid gap-4 p-8 sm:p-10">
            {platformWhyEstateOS.map((point) => (
              <div
                key={point}
                className="rounded-3xl border border-[var(--line)] bg-[var(--sand-50)] p-5 text-sm font-medium text-[var(--ink-700)]"
              >
                {point}
              </div>
            ))}
          </Card>
        </Container>
      </section>

      <section>
        <Container className="space-y-10">
          <SectionHeading
            eyebrow="Hybrid pricing"
            title="Subscription revenue and transaction commission, modeled honestly."
            description="Companies can be billed monthly or annually, or granted access by superadmin. Successful property payments still generate EstateOS commission either way."
          />
          <div className="grid gap-6 lg:grid-cols-2">
            {plans.map((plan) => (
              <Card key={`${plan.code}-${plan.interval}`} className="p-8">
                <div className="text-sm uppercase tracking-[0.18em] text-[var(--ink-500)]">
                  {plan.interval.toLowerCase()}
                </div>
                <h3 className="mt-3 text-2xl font-semibold text-[var(--ink-950)]">{plan.name}</h3>
                <div className="mt-4 text-4xl font-semibold text-[var(--ink-950)]">
                  {formatCurrency(plan.priceAmount, plan.currency)}
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-600)]">
                  {plan.description ?? "Operational plan for tenant companies using EstateOS."}
                </p>
                <div className="mt-6 rounded-3xl bg-[var(--sand-50)] p-5 text-sm leading-7 text-[var(--ink-700)]">
                  Transaction commission still applies on successful buyer payments, including manually granted plans.
                </div>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      <section>
        <Container>
          <Card className="bg-[linear-gradient(135deg,#0f1a23,#174b4d)] px-8 py-12 text-white sm:px-12">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="text-sm uppercase tracking-[0.22em] text-white/68">Start a pilot</div>
                <h2 className="mt-3 font-serif text-4xl text-white">
                  Launch EstateOS for your real estate company with a platform that already understands listings, transactions, and payout control.
                </h2>
              </div>
              <div className="flex flex-wrap gap-4">
                <Link href="/platform/contact">
                  <Button size="lg">Talk to EstateOS</Button>
                </Link>
                <Link href="/platform/features">
                  <Button variant="secondary" size="lg">
                    Explore capabilities
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </Container>
      </section>
    </div>
  );
}
