import {
  Activity,
  ClipboardCheck,
  MessageSquare,
  UserCheck,
  UserPlus,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { ActivityItem, ActivityTone } from "@/modules/admin/activity-feed";

const ICONS: Record<string, LucideIcon> = {
  UserCheck,
  UserPlus,
  Wallet,
  MessageSquare,
  ClipboardCheck,
};

const TONE_CHIP: Record<ActivityTone, string> = {
  brand: "bg-[var(--brand-50)] text-[var(--brand-ink)]",
  green: "bg-[var(--success-50)] text-[var(--success-700)]",
  amber: "bg-[var(--amber-50)] text-[var(--amber-700)]",
  neutral: "bg-[var(--sand-100)] text-[var(--ink-600)]",
};

/**
 * Read-only owner activity timeline: the latest company-wide events (visitors,
 * leads, payments, buyer messages, reservations) at a glance. Auto-refreshes
 * with the Executive Overview's live poller.
 */
export function OwnerActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <section
      aria-label="Recent activity"
      className="rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--surface-1,#fff)] p-5 shadow-[var(--shadow-sm)] sm:p-6"
    >
      <div className="flex items-center gap-2.5">
        <span
          className="grid h-9 w-9 place-items-center rounded-[var(--radius-md)] bg-[var(--sand-100)] text-[var(--ink-700)]"
          aria-hidden
        >
          <Activity className="h-[18px] w-[18px]" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-[var(--ink-950)]">Recent activity</h2>
          <p className="text-xs text-[var(--ink-500)]">The latest across your workspace, newest first.</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-1 py-10 text-center">
          <p className="text-sm font-medium text-[var(--ink-700)]">Nothing has happened yet.</p>
          <p className="text-sm text-[var(--ink-500)]">
            Visitors, leads, payments, messages, and reservations will appear here as they come in.
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--line)]">
          {items.map((item) => {
            const Icon = ICONS[item.icon] ?? Activity;
            return (
              <li key={item.id} className="flex items-center gap-3 py-3">
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${TONE_CHIP[item.tone]}`}
                  aria-hidden
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--ink-900)]">{item.title}</p>
                  <p className="truncate text-xs text-[var(--ink-500)]">{item.detail}</p>
                </div>
                <span className="shrink-0 whitespace-nowrap text-xs text-[var(--ink-400)]">{item.when}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
