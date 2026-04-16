"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { OnboardingChecklist } from "@/modules/onboarding/checklist";
import { cn } from "@/lib/utils";

export function OnboardingChecklistCard({
  checklist,
  workspaceSlug,
}: {
  checklist: OnboardingChecklist;
  workspaceSlug: string | null;
}) {
  const storageKey = useMemo(
    () => `estateos:onboarding-checklist:${workspaceSlug ?? "workspace"}`,
    [workspaceSlug],
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

  // Auto-hide once everything is done (after a brief moment to celebrate)
  if (dismissed || checklist.allComplete) {
    return null;
  }

  const { steps, completedCount, totalCount } = checklist;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="text-base font-semibold text-[var(--ink-900)]">
              Set up your workspace
            </span>
            <span className="rounded-full bg-[var(--sand-100)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-500)]">
              {completedCount}/{totalCount}
            </span>
          </div>
          <p className="text-sm text-[var(--ink-500)]">
            Complete these steps to get the most out of EstateOS.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-400)] transition hover:bg-[var(--sand-50)] hover:text-[var(--ink-700)]"
        >
          Dismiss
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-6 pb-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--sand-100)]">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <ul className="divide-y divide-[var(--line)] px-2 pb-2 pt-1">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-center gap-4 rounded-[var(--radius-md)] px-4 py-3.5">
            {/* Step number / checkmark */}
            <div className="shrink-0">
              {step.complete ? (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50">
                  <CheckIcon className="h-4 w-4 text-emerald-600" />
                </span>
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--line)] bg-white">
                  <span className="text-[11px] font-semibold text-[var(--ink-400)]">
                    {index + 1}
                  </span>
                </span>
              )}
            </div>

            {/* Text */}
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm font-medium",
                  step.complete
                    ? "text-[var(--ink-400)] line-through decoration-[var(--ink-300)]"
                    : "text-[var(--ink-900)]",
                )}
              >
                {step.title}
              </p>
              {!step.complete && (
                <p className="mt-0.5 text-xs text-[var(--ink-500)]">{step.description}</p>
              )}
            </div>

            {/* CTA */}
            {!step.complete && (
              <Link
                href={step.href}
                className="shrink-0 rounded-[var(--radius-sm)] border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink-700)] transition hover:bg-[var(--sand-50)] hover:text-[var(--ink-900)]"
              >
                {step.cta} →
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="2.5,8.5 6.5,12.5 13.5,4" />
    </svg>
  );
}
