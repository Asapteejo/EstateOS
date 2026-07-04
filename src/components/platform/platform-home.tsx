import Link from "next/link";
import {
  Building2,
  Coins,
  LayoutDashboard,
  Layers,
  ShieldCheck,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import { PlatformHeroPreview } from "@/components/platform/platform-hero-preview";
import { PlatformPricing } from "@/components/platform/platform-pricing";
import { Container } from "@/components/shared/container";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeading } from "@/components/shared/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getPlatformPricingPlans,
  platformFeatures,
  platformHowItWorks,
  platformStats,
  platformWhyEstateOS,
} from "@/modules/platform-site/content";

const FEATURE_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  workflow: Workflow,
  coins: Coins,
  layers: Layers,
};

const STEP_ICONS: Record<string, LucideIcon> = {
  building: Building2,
  users: Users,
  shield: ShieldCheck,
};

export async function PlatformHome() {
  const plans = await getPlatformPricingPlans();

  return (
    <div className="space-y-24 pb-24">
      {/* Hero */}
      <section className="pt-12">
        <Container>
          <Card className="overflow-hidden bg-[linear-gradient(135deg,#07131a,#0b3e4f_48%,#d7b98f_150%)] px-6 py-12 text-white sm:px-12 sm:py-16">
            <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-7">
                <Badge className="bg-white/12 text-white">Sales &amp; payments OS for property developers</Badge>
                <div className="space-y-5">
                  <h1 className="max-w-2xl font-serif text-4xl leading-[1.05] sm:text-6xl">
                    Run property sales like one operating system.
                  </h1>
                  <p className="max-w-xl text-lg leading-8 text-white/80">
                    EstateOS moves buyers from inquiry to inspection, reservation, payment, and
                    receipt — and flags every overdue balance — so your team stops losing money to
                    spreadsheets, WhatsApp threads, and manual transfer checks.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link href="/app/onboarding">
                    <Button size="lg">Get started</Button>
                  </Link>
                  <Link href="/demo">
                    <Button variant="secondary" size="lg">
                      View demo
                    </Button>
                  </Link>
                  <Link
                    href="/platform/pricing"
                    className="admin-focus rounded-full px-2 text-sm font-semibold text-white/80 underline-offset-4 hover:text-white hover:underline"
                  >
                    See pricing
                  </Link>
                </div>
              </div>

              <Reveal delay={0.1} className="lg:pl-4">
                <PlatformHeroPreview />
              </Reveal>
            </div>
          </Card>
        </Container>
      </section>

      {/* Honest capability strip */}
      <section className="-mt-12">
        <Container>
          <Reveal>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[24px] border border-[var(--border-subtle)] bg-[var(--line)] lg:grid-cols-4">
              {platformStats.map((stat) => (
                <div key={stat.label} className="bg-[var(--tenant-card,#fff)] p-6 sm:p-7">
                  <div className="font-serif text-4xl text-[var(--ink-950)]">{stat.value}</div>
                  <div className="mt-2 text-sm leading-6 text-[var(--ink-600)]">{stat.label}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </Container>
      </section>

      {/* Core platform */}
      <section>
        <Container className="space-y-10">
          <Reveal>
            <SectionHeading
              eyebrow="Core platform"
              title="One operating system for the entire sales and payment workflow."
              description="EstateOS keeps listings, CRM, the buyer portal, and payment operations in one place, so teams close deals faster and lose less money to follow-up gaps."
            />
          </Reveal>
          <div className="grid gap-6 lg:grid-cols-2">
            {platformFeatures.map((feature, index) => {
              const Icon = FEATURE_ICONS[feature.icon] ?? LayoutDashboard;
              return (
                <Reveal key={feature.title} delay={index * 0.06}>
                  <Card interactive className="h-full p-8">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--brand-100,#dcfce7)] text-[var(--brand-700)]">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <h3 className="mt-5 text-xl font-semibold text-[var(--ink-950)]">{feature.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-[var(--ink-600)]">{feature.body}</p>
                  </Card>
                </Reveal>
              );
            })}
          </div>
        </Container>
      </section>

      {/* How it works */}
      <section>
        <Container className="space-y-10">
          <Reveal>
            <SectionHeading
              eyebrow="How it works"
              title="From first company to centralized revenue control."
              description="Stand up a tenant, run buyer operations cleanly, and keep plan, commission, and payout visibility in one place."
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
                    <h3 className="mt-5 text-xl font-semibold text-[var(--ink-950)]">{step.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-[var(--ink-600)]">{step.body}</p>
                  </Card>
                </Reveal>
              );
            })}
          </div>
        </Container>
      </section>

      {/* Why EstateOS */}
      <section>
        <Container className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Reveal>
            <Card className="h-full p-8 sm:p-10">
              <SectionHeading
                eyebrow="Why EstateOS"
                title="A cleaner way to run property sales."
                description="See every deal, every expected payment, and every collections risk — without weakening tenant isolation."
              />
            </Card>
          </Reveal>
          <Reveal delay={0.08}>
            <Card className="grid h-full gap-3 p-8 sm:p-10">
              {platformWhyEstateOS.map((point) => (
                <div
                  key={point}
                  className="flex items-start gap-3 rounded-3xl border border-[var(--line)] bg-[var(--sand-50)] p-5 text-sm font-medium text-[var(--ink-700)]"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-100,#dcfce7)] text-[var(--brand-700)]">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  {point}
                </div>
              ))}
            </Card>
          </Reveal>
        </Container>
      </section>

      {/* Pricing */}
      <section>
        <Container className="space-y-10">
          <Reveal>
            <SectionHeading
              eyebrow="Hybrid pricing"
              title="Subscription plus transaction commission, modeled honestly."
              description="Bill monthly or annually — or grant access by superadmin. Successful property payments still generate EstateOS commission either way."
            />
          </Reveal>
          <Reveal delay={0.06}>
            <PlatformPricing plans={plans} />
          </Reveal>
        </Container>
      </section>

      {/* Closing CTA */}
      <section>
        <Container>
          <Reveal>
            <Card className="bg-[linear-gradient(135deg,#0f1a23,#174b4d)] px-8 py-12 text-white sm:px-12">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <div className="text-sm uppercase tracking-[0.22em] text-white/68">Start a pilot</div>
                  <h2 className="mt-3 font-serif text-3xl leading-tight text-white sm:text-4xl">
                    Launch EstateOS for your sales team — on a platform that already understands deals,
                    payments, and collections.
                  </h2>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href="/app/onboarding">
                    <Button size="lg">Start your workspace</Button>
                  </Link>
                  <Link href="/demo">
                    <Button variant="secondary" size="lg">
                      View demo
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          </Reveal>
        </Container>
      </section>
    </div>
  );
}
