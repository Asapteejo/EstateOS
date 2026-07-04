import Link from "next/link";
import { BarChart3, Building2, Mail, ReceiptText, Users, type LucideIcon } from "lucide-react";

import { Container } from "@/components/shared/container";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeading } from "@/components/shared/section-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const TOPICS: { icon: LucideIcon; label: string }[] = [
  { icon: Building2, label: "Tenant onboarding strategy" },
  { icon: ReceiptText, label: "Billing and commission model" },
  { icon: Users, label: "Buyer portal and transaction workflow" },
  { icon: BarChart3, label: "Platform-owner reporting and payout readiness" },
];

export default function PlatformContactPage() {
  return (
    <div className="py-16">
      <Container className="grid items-start gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Reveal>
          <Card className="h-full p-8 sm:p-10">
            <SectionHeading
              eyebrow="Request a demo"
              title="Talk to the EstateOS team about launching a pilot."
              description="Use this platform contact surface for SaaS evaluation, pricing, rollout planning, and platform-owner questions. Tenant property inquiries should still go through the tenant public site contact flow."
            />
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {TOPICS.map((topic) => (
                <div
                  key={topic.label}
                  className="flex items-start gap-3 rounded-3xl border border-[var(--line)] bg-[var(--sand-50)] p-5 text-sm font-medium text-[var(--ink-700)]"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-100,#dcfce7)] text-[var(--brand-700)]">
                    <topic.icon className="h-4 w-4" aria-hidden />
                  </span>
                  {topic.label}
                </div>
              ))}
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.08}>
          <Card className="h-full p-8 sm:p-10">
            <div className="text-sm uppercase tracking-[0.2em] text-[var(--ink-500)]">Next step</div>
            <h2 className="mt-3 font-serif text-3xl text-[var(--ink-950)]">
              Start with a guided pilot conversation.
            </h2>
            <p className="mt-4 text-sm leading-7 text-[var(--ink-600)]">
              EstateOS is structured for multi-tenant rollout, company-level billing, and
              commission-aware transaction processing. The quickest path is to align plan, payout,
              and launch expectations before enabling live providers.
            </p>

            <Link
              href="mailto:hello@estateos.app"
              className="admin-focus mt-8 flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--sand-50)] p-4 transition hover:border-[var(--brand-700)] hover:bg-white"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-100,#dcfce7)] text-[var(--brand-700)]">
                <Mail className="h-5 w-5" aria-hidden />
              </span>
              <span>
                <span className="block text-xs uppercase tracking-[0.16em] text-[var(--ink-500)]">
                  Email us
                </span>
                <span className="block text-sm font-semibold text-[var(--ink-950)]">
                  hello@estateos.app
                </span>
              </span>
            </Link>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/app/onboarding">
                <Button size="lg">Start your workspace</Button>
              </Link>
              <Link href="/platform/pricing">
                <Button variant="outline" size="lg">
                  Review pricing
                </Button>
              </Link>
            </div>
          </Card>
        </Reveal>
      </Container>
    </div>
  );
}
