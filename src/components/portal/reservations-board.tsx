import { CalendarClock, Home } from "lucide-react";

import { StatCard } from "@/components/admin/admin-ui";

/** A reservation row from getBuyerReservationsTable:
 *  [reference, propertyTitle, status, reservedUntil]. */
type ReservationRow = string[];

const STATUS: Record<string, { label: string; chip: string }> = {
  PENDING: { label: "Pending", chip: "bg-[var(--amber-50)] text-[var(--amber-700)]" },
  ACTIVE: { label: "Active", chip: "bg-[var(--success-50)] text-[var(--success-700)]" },
  CONVERTED: { label: "Converted to sale", chip: "bg-[var(--brand-50)] text-[var(--brand-ink)]" },
  EXPIRED: { label: "Expired", chip: "bg-[var(--sand-100)] text-[var(--ink-600)]" },
  CANCELLED: { label: "Cancelled", chip: "bg-[var(--danger-50)] text-[var(--danger-700)]" },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS[status] ?? { label: status, chip: "bg-[var(--sand-100)] text-[var(--ink-600)]" };
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${meta.chip}`}>
      {meta.label}
    </span>
  );
}

export function ReservationsBoard({ rows }: { rows: ReservationRow[] }) {
  const total = rows.length;
  const active = rows.filter((r) => r[2] === "ACTIVE").length;
  const pending = rows.filter((r) => r[2] === "PENDING").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total reservations" value={String(total)} />
        <StatCard label="Active" value={String(active)} tone={active > 0 ? "success" : "default"} />
        <StatCard label="Pending" value={String(pending)} tone={pending > 0 ? "accent" : "default"} />
      </div>

      <section
        aria-label="Your reservations"
        className="rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--surface-1,#fff)] p-5 shadow-[var(--shadow-sm)] sm:p-6"
      >
        <h2 className="text-base font-semibold text-[var(--ink-950)]">Your reservations</h2>
        <p className="mt-0.5 text-sm text-[var(--ink-500)]">
          Every unit you&apos;ve reserved, with its current status and hold expiry.
        </p>

        {rows.length === 0 ? (
          <div className="mt-6 flex flex-col items-center justify-center gap-1 py-12 text-center">
            <span className="mb-2 grid h-11 w-11 place-items-center rounded-full bg-[var(--sand-100)] text-[var(--ink-500)]" aria-hidden>
              <Home className="h-5 w-5" />
            </span>
            <p className="text-sm font-medium text-[var(--ink-700)]">No reservations yet.</p>
            <p className="text-sm text-[var(--ink-500)]">
              When you reserve a property, it will appear here with its hold status.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((row, index) => {
              const [reference, property, status, reservedUntil] = row;
              return (
                <li
                  key={`${reference}-${index}`}
                  className="premium-row flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] bg-[var(--sand-100)] px-4 py-4"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-[var(--ink-950)]">{property}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--ink-500)]">
                      <span className="numeric">{reference}</span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                        Hold: {reservedUntil}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={status} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
