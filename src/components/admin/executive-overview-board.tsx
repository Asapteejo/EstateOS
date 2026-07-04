import { ConciergeBell, TrendingUp, Wallet, type LucideIcon } from "lucide-react";

import { LiveRefresh } from "@/components/dashboard/live-refresh";
import type { ExecTone, ExecutiveOverview } from "@/modules/admin/executive-overview";

const SECTION_ICONS: Record<string, LucideIcon> = {
  TrendingUp,
  Wallet,
  ConciergeBell,
};

const TONE_TEXT: Record<ExecTone, string> = {
  brand: "text-[var(--ink-950)]",
  amber: "text-[var(--amber-700,#b45309)]",
  green: "text-[var(--success-700,#15803d)]",
  red: "text-[var(--danger-700,#b91c1c)]",
  neutral: "text-[var(--ink-950)]",
};

export function ExecutiveOverviewBoard({ overview }: { overview: ExecutiveOverview }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="live-dot" aria-hidden />
          <div>
            <h2 className="text-sm font-semibold text-[var(--ink-950)]">Company pulse</h2>
            <p className="text-xs text-[var(--ink-500)]">
              Live across sales, finance, and the front desk — refreshes automatically.
            </p>
          </div>
        </div>
        <LiveRefresh intervalMs={15_000} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {overview.sections.map((section, index) => {
          const Icon = SECTION_ICONS[section.icon] ?? TrendingUp;
          return (
            <section
              key={section.key}
              aria-label={section.title}
              className="card-rise premium-card rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--surface-1,#fff)] p-5 shadow-[var(--shadow-sm)] sm:p-6"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="grid h-9 w-9 place-items-center rounded-[var(--radius-md)] bg-[var(--sand-100,#f1f5f9)] text-[var(--ink-700)]"
                  aria-hidden
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-600)]">
                  {section.title}
                </h2>
              </div>

              <dl className="mt-5 space-y-4">
                {section.kpis.map((kpi) => (
                  <div key={kpi.key} className="flex items-baseline justify-between gap-3">
                    <dt className="text-sm text-[var(--ink-500)]">{kpi.label}</dt>
                    <dd className={`numeric shrink-0 text-lg font-semibold tracking-tight ${TONE_TEXT[kpi.tone]}`}>
                      {kpi.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}
      </div>
    </div>
  );
}
