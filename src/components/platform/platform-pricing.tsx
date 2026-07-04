import Link from "next/link";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { platformPlanFeatures } from "@/modules/platform-site/content";
import { formatCurrency } from "@/lib/utils";

type Plan = {
  code: string;
  name: string;
  interval: string;
  priceAmount: number;
  currency: string;
  description: string | null;
};

function intervalSuffix(interval: string) {
  return interval.toUpperCase() === "ANNUAL" ? "/year" : "/month";
}

/**
 * Shared pricing block for the platform marketing site (landing + /platform/pricing).
 *
 * Adds the things a buyer actually needs to decide: a concrete what's-included
 * list, the annual saving made explicit (derived from the real plan amounts —
 * not invented), and a CTA on every card. The annual plan is highlighted as the
 * best value when a monthly counterpart exists to compare against.
 */
export function PlatformPricing({ plans }: { plans: Plan[] }) {
  const monthly = plans.find((plan) => plan.interval.toUpperCase() === "MONTHLY");
  const annual = plans.find((plan) => plan.interval.toUpperCase() === "ANNUAL");

  const annualSaving =
    monthly && annual ? monthly.priceAmount * 12 - annual.priceAmount : 0;
  const monthsFree =
    monthly && annualSaving > 0 ? Math.round(annualSaving / monthly.priceAmount) : 0;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      {plans.map((plan) => {
        const isAnnual = plan.interval.toUpperCase() === "ANNUAL";
        const highlight = isAnnual && annualSaving > 0;

        return (
          <Card
            key={`${plan.code}-${plan.interval}`}
            className={
              highlight
                ? "relative p-8 ring-2 ring-[var(--brand-700)]"
                : "relative p-8"
            }
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)]">
                {plan.interval.toLowerCase()}
              </span>
              {highlight ? (
                <span className="inline-flex rounded-full bg-[var(--brand-700)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                  Best value
                </span>
              ) : null}
            </div>

            <h3 className="mt-3 text-2xl font-semibold text-[var(--ink-950)]">{plan.name}</h3>

            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-4xl font-semibold tabular-nums text-[var(--ink-950)]">
                {formatCurrency(plan.priceAmount, plan.currency)}
              </span>
              <span className="text-sm font-medium text-[var(--ink-500)]">
                {intervalSuffix(plan.interval)}
              </span>
            </div>

            {highlight ? (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--success-50,#ecfdf5)] px-3 py-1.5 text-[13px] font-semibold text-emerald-700">
                Save {formatCurrency(annualSaving, plan.currency)}
                {monthsFree > 0 ? ` · ${monthsFree} months free` : ""}
              </div>
            ) : null}

            <p className="mt-4 text-sm leading-7 text-[var(--ink-600)]">
              {plan.description ?? "Operational plan for tenant companies using EstateOS."}
            </p>

            <Link href="/app/onboarding" className="mt-6 block">
              <Button size="lg" variant={highlight ? "default" : "secondary"} className="w-full">
                Start your workspace
              </Button>
            </Link>

            <ul className="mt-6 space-y-3 border-t border-[var(--line)] pt-6">
              {platformPlanFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm text-[var(--ink-700)]">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-100,#dcfce7)] text-[var(--brand-700)]">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>

            <p className="mt-6 rounded-2xl bg-[var(--sand-50)] p-4 text-[13px] leading-6 text-[var(--ink-600)]">
              Transaction commission still applies on successful buyer payments, including manually
              granted plans.
            </p>
          </Card>
        );
      })}
    </div>
  );
}
