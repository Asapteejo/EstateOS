"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ActivationStep = {
  key: string;
  title: string;
  description: string;
  complete: boolean;
  href: string;
  ctaLabel: string;
};

export function DealBoardActivationCard({
  companySlug,
  activation,
  overdueCount = 0,
  onOpenCollectionsMode,
  readOnly = false,
  ctaHref,
  inspect = false,
}: {
  companySlug: string | null;
  activation: {
    completedCount: number;
    total: number;
    steps: ActivationStep[];
  };
  overdueCount?: number;
  onOpenCollectionsMode?: () => void;
  readOnly?: boolean;
  ctaHref?: string;
  inspect?: boolean;
}) {
  const storageKey = useMemo(
    () => `estateos:activation-checklist:${companySlug ?? "workspace"}`,
    [companySlug],
  );
  const [dismissed, setDismissed] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem(storageKey) === "dismissed",
  );

  function dismiss() {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, "dismissed");
    }
  }

  function reopen() {
    setDismissed(false);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey);
    }
  }

  const nextStep = activation.steps.find((step) => !step.complete) ?? activation.steps[activation.steps.length - 1];

  if (dismissed) {
    return (
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={reopen}>
          Show setup progress
        </Button>
      </div>
    );
  }

  return (
    <Card className="rounded-[32px] border-[var(--line)] bg-white p-6 sm:p-7">
      {inspect ? (
        <div className="mb-4 inline-flex rounded-full border border-dashed border-[var(--line)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-500)]">
          Inspect: Activation Checklist
        </div>
      ) : null}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--ink-500)]">
            Setup progress
          </div>
          <h3 className="text-xl font-semibold text-[var(--ink-950)]">
            {activation.completedCount}/{activation.total} activation milestones completed
          </h3>
          <p className="max-w-2xl text-sm leading-7 text-[var(--ink-600)]">
            Move from first deal to first payment fast. The next milestone is{" "}
            <span className="font-semibold text-[var(--ink-950)]">{nextStep?.title.toLowerCase()}</span>.
          </p>
          {readOnly ? (
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--ink-500)]">
              Read-only demo workspace
            </p>
          ) : null}
        </div>
        <Button variant="outline" size="sm" onClick={dismiss}>
          Dismiss
        </Button>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {activation.steps.map((step) => (
          <div key={step.key} className="rounded-[24px] border border-[var(--line)] bg-[var(--sand-50)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-semibold text-[var(--ink-950)]">{step.title}</div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  step.complete
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-white text-[var(--ink-600)] ring-1 ring-[var(--line)]"
                }`}
              >
                {step.complete ? "Done" : "Next"}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-600)]">{step.description}</p>
            <div className="mt-4">
              <Link href={readOnly ? ctaHref ?? "/app/onboarding" : step.href}>
                <Button size="sm" variant={step.complete ? "outline" : "default"}>
                  {readOnly ? "Start your workspace" : step.ctaLabel}
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {overdueCount > 0 ? (
        <div className="mt-4 flex flex-col gap-3 rounded-[24px] border border-rose-200 bg-rose-50 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-rose-700">Collections need attention now</div>
            <p className="mt-1 text-sm leading-6 text-rose-700/85">
              {overdueCount} overdue deal{overdueCount === 1 ? "" : "s"} need follow-up now. Open collections mode and work the highest-risk money first.
            </p>
          </div>
          {onOpenCollectionsMode ? (
            <Button size="sm" className="bg-rose-600 hover:bg-rose-700" onClick={onOpenCollectionsMode}>
              Open collections mode
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
