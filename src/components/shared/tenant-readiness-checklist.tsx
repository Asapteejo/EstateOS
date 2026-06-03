import Link from "next/link";

import { Card } from "@/components/ui/card";
import type { TenantReadinessItem } from "@/lib/ops/tenant-readiness";
import { cn } from "@/lib/utils";

const statusLabels = {
  complete: "Complete",
  warning: "Warning",
  missing: "Missing",
} as const;

const statusClasses = {
  complete: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  missing: "border-rose-200 bg-rose-50 text-rose-800",
} as const;

export function TenantReadinessChecklist({
  title = "Go-live readiness",
  description = "Resolve these items before onboarding real buyers and payments.",
  items,
}: {
  title?: string;
  description?: string;
  items: TenantReadinessItem[];
}) {
  const missing = items.filter((item) => item.status === "missing").length;
  const warnings = items.filter((item) => item.status === "warning").length;
  const complete = items.filter((item) => item.status === "complete").length;

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--ink-950)]">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--ink-600)]">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{complete} complete</span>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">{warnings} warning</span>
          <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">{missing} missing</span>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-[var(--line)] bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-[var(--ink-950)]">{item.label}</div>
                <div className="mt-1 text-xs font-medium text-[var(--ink-500)]">Owner: {item.owner}</div>
              </div>
              <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]", statusClasses[item.status])}>
                {statusLabels[item.status]}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-600)]">{item.explanation}</p>
            <Link
              href={item.actionLink}
              className="mt-3 inline-flex rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-700)] transition hover:bg-[var(--sand-50)]"
            >
              Open action
            </Link>
          </div>
        ))}
      </div>
    </Card>
  );
}
