import { CalendarClock, Clock, MapPin, User } from "lucide-react";

import type { InspectionManagementItem } from "@/modules/inspections/service";
import { StatCard } from "@/components/admin/admin-ui";
import { WhatsAppButton } from "@/components/shared/whatsapp-button";

const STATUS: Record<string, { label: string; chip: string }> = {
  CONFIRMED: { label: "Confirmed", chip: "bg-[var(--success-50)] text-[var(--success-700)]" },
  PENDING: { label: "Pending", chip: "bg-[var(--amber-50)] text-[var(--amber-700)]" },
  REQUESTED: { label: "Requested", chip: "bg-[var(--amber-50)] text-[var(--amber-700)]" },
  RESCHEDULED: { label: "Rescheduled", chip: "bg-[var(--amber-50)] text-[var(--amber-700)]" },
  COMPLETED: { label: "Completed", chip: "bg-[var(--sand-100)] text-[var(--ink-600)]" },
  CANCELLED: { label: "Cancelled", chip: "bg-[var(--danger-50)] text-[var(--danger-700)]" },
  NO_SHOW: { label: "No show", chip: "bg-[var(--danger-50)] text-[var(--danger-700)]" },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS[status] ?? { label: status, chip: "bg-[var(--sand-100)] text-[var(--ink-600)]" };
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${meta.chip}`}>
      {meta.label}
    </span>
  );
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayLabel(d: Date, today: Date): string {
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(today).getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function timeLabel(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * A front-desk agenda: upcoming property viewings from today onward, grouped by
 * day and ordered by time. Read-only overview — use the Bookings page to
 * reschedule or change status.
 */
export function ScheduleAgenda({ items }: { items: InspectionManagementItem[] }) {
  const now = new Date();
  const from = startOfDay(now).getTime();

  const upcoming = items
    .map((item) => ({ ...item, date: new Date(item.scheduledFor) }))
    .filter((item) => !Number.isNaN(item.date.getTime()) && item.date.getTime() >= from)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const todayCount = upcoming.filter((item) => startOfDay(item.date).getTime() === from).length;

  // Group into ordered day buckets.
  const groups: Array<{ key: string; label: string; items: typeof upcoming }> = [];
  for (const item of upcoming) {
    const key = startOfDay(item.date).toISOString().slice(0, 10);
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, label: dayLabel(item.date, now), items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Upcoming viewings" value={String(upcoming.length)} />
        <StatCard label="Today" value={String(todayCount)} tone={todayCount > 0 ? "accent" : "default"} />
        <StatCard label="Scheduled days" value={String(groups.length)} />
      </div>

      {groups.length === 0 ? (
        <div className="rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--surface-1,#fff)] p-5 shadow-[var(--shadow-sm)] sm:p-6">
          <div className="flex flex-col items-center justify-center gap-1 py-12 text-center">
            <span className="mb-2 grid h-11 w-11 place-items-center rounded-full bg-[var(--sand-100)] text-[var(--ink-500)]" aria-hidden>
              <CalendarClock className="h-5 w-5" />
            </span>
            <p className="text-sm font-medium text-[var(--ink-700)]">No upcoming viewings.</p>
            <p className="text-sm text-[var(--ink-500)]">Booked property viewings will appear here, grouped by day.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key} aria-label={group.label}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-[var(--ink-950)]">{group.label}</h2>
                <span className="text-xs text-[var(--ink-500)]">
                  {group.items.length} viewing{group.items.length > 1 ? "s" : ""}
                </span>
              </div>
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <li
                    key={item.id}
                    className="premium-row flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-lg)] bg-[var(--surface-1,#fff)] px-4 py-3.5 shadow-[var(--shadow-xs)]"
                  >
                    <div className="flex w-16 shrink-0 items-center gap-1.5 text-sm font-semibold text-[var(--ink-950)]">
                      <Clock className="h-3.5 w-3.5 text-[var(--ink-400)]" aria-hidden />
                      {timeLabel(item.date)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate text-sm font-medium text-[var(--ink-900)]">
                        <User className="h-3.5 w-3.5 shrink-0 text-[var(--ink-400)]" aria-hidden />
                        {item.fullName}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--ink-500)]">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" aria-hidden />
                          {item.propertyTitle}
                        </span>
                        {item.assignedStaffName ? <span>· {item.assignedStaffName}</span> : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={item.status} />
                      <WhatsAppButton
                        phone={item.phone}
                        label="Confirm"
                        message={`Hi ${item.fullName}, just confirming your viewing of ${item.propertyTitle}. Looking forward to seeing you!`}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
