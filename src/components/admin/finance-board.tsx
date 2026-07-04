import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Hourglass,
  ReceiptText,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { LiveRefresh } from "@/components/dashboard/live-refresh";
import type { FinanceOverview, FinanceTone } from "@/modules/finance/service";

const STAT_ICONS: Record<string, LucideIcon> = {
  Wallet,
  TrendingUp,
  Hourglass,
  AlertTriangle,
  Clock,
  ReceiptText,
};

const TONE_CHIP: Record<FinanceTone, string> = {
  brand: "bg-[var(--brand-50,#ecfdf5)] text-[var(--brand-ink,#0e5b49)]",
  amber: "bg-[var(--amber-50,#fffbeb)] text-[var(--amber-700,#b45309)]",
  green: "bg-[var(--success-50,#ecfdf5)] text-[var(--success-700,#15803d)]",
  red: "bg-[var(--danger-50,#fef2f2)] text-[var(--danger-700,#b91c1c)]",
  neutral: "bg-[var(--sand-100,#f1f5f9)] text-[var(--ink-700,#334155)]",
};

export function FinanceBoard({ overview }: { overview: FinanceOverview }) {
  return (
    <div className="space-y-6">
      <section
        aria-label="Finance metrics"
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6"
      >
        {overview.stats.map((stat) => {
          const Icon = STAT_ICONS[stat.icon] ?? Wallet;
          return (
            <div
              key={stat.key}
              className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1,#fff)] p-4 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-md"
            >
              <span
                className={`grid h-9 w-9 place-items-center rounded-[var(--radius-md)] ${TONE_CHIP[stat.tone]}`}
                aria-hidden
              >
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <div className="numeric mt-3 break-words text-xl font-semibold tracking-tight text-[var(--ink-950)]">
                {stat.value}
              </div>
              <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-[var(--ink-500)]">
                {stat.label}
              </div>
            </div>
          );
        })}
      </section>

      <section
        aria-label="Recent payments"
        className="rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--surface-1,#fff)] p-5 shadow-[var(--shadow-sm)] sm:p-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--ink-950)]">Recent payments</h2>
          <LiveRefresh intervalMs={20_000} />
        </div>

        {overview.recentPayments.length === 0 ? (
          <div className="mt-6 flex flex-col items-center justify-center gap-1 py-10 text-center">
            <p className="text-sm font-medium text-[var(--ink-700)]">No payments recorded yet.</p>
            <p className="text-sm text-[var(--ink-500)]">
              Successful payments will appear here as buyers settle their balances.
            </p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--line)]">
            {overview.recentPayments.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-3">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--success-50,#ecfdf5)] text-[var(--success-700,#15803d)]"
                  aria-hidden
                >
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--ink-900)]">{item.payer}</p>
                  <p className="truncate text-xs text-[var(--ink-400)]">{item.reference}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="numeric text-sm font-semibold text-[var(--ink-900)]">{item.amount}</p>
                  <p className="text-xs text-[var(--ink-400)]">{item.when}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
