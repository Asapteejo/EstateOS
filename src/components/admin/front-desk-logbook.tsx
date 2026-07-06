import { LogIn, Phone, UserCheck, Users } from "lucide-react";

import {
  checkOutVisitorAction,
  logCallAction,
  logVisitorAction,
} from "@/modules/front-desk/logbook-actions";
import type { FrontDeskLogbook } from "@/modules/front-desk/logbook";
import { WhatsAppButton } from "@/components/shared/whatsapp-button";
import { Select } from "@/components/ui/select";

const inputClass =
  "admin-focus w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink-900)] placeholder:text-[var(--ink-400)]";
const buttonClass =
  "admin-focus inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--brand-700)] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-800,#15803d)]";

function StatChip({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1,#fff)] px-4 py-3 shadow-[var(--shadow-sm)]">
      <span className="grid h-9 w-9 place-items-center rounded-[var(--radius-md)] bg-[var(--sand-100,#f1f5f9)] text-[var(--ink-700)]" aria-hidden>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div>
        <div className="numeric text-xl font-semibold text-[var(--ink-950)]">{value}</div>
        <div className="text-xs font-medium uppercase tracking-wide text-[var(--ink-500)]">{label}</div>
      </div>
    </div>
  );
}

export function FrontDeskLogbookView({ logbook }: { logbook: FrontDeskLogbook }) {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatChip icon={Users} label="Visitors today" value={logbook.visitorsToday} />
        <StatChip icon={UserCheck} label="Currently in" value={logbook.activeVisitors} />
        <StatChip icon={Phone} label="Calls today" value={logbook.callsToday} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Visitors column */}
        <section className="rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--surface-1,#fff)] p-5 shadow-[var(--shadow-sm)] sm:p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--ink-950)]">
            <LogIn className="h-[18px] w-[18px] text-[var(--ink-500)]" aria-hidden /> Log a visitor
          </h2>
          <form action={logVisitorAction} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input name="fullName" required placeholder="Full name *" className={`${inputClass} sm:col-span-2`} aria-label="Visitor full name" />
            <input name="phone" placeholder="Phone" className={inputClass} aria-label="Visitor phone" />
            <input name="hostName" placeholder="Here to see" className={inputClass} aria-label="Host name" />
            <input name="purpose" placeholder="Purpose of visit" className={`${inputClass} sm:col-span-2`} aria-label="Purpose of visit" />
            <div className="sm:col-span-2">
              <button type="submit" className={buttonClass}>
                <LogIn className="h-4 w-4" aria-hidden /> Check in visitor
              </button>
            </div>
          </form>

          <ul className="mt-5 divide-y divide-[var(--line)]">
            {logbook.visitors.length === 0 ? (
              <li className="py-6 text-center text-sm text-[var(--ink-500)]">No visitors logged yet today.</li>
            ) : (
              logbook.visitors.map((visitor) => (
                <li key={visitor.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--ink-900)]">{visitor.fullName}</p>
                    <p className="truncate text-xs text-[var(--ink-500)]">
                      {[visitor.hostName ? `To see ${visitor.hostName}` : null, visitor.purpose, visitor.when]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {visitor.phone ? (
                      <WhatsAppButton
                        phone={visitor.phone}
                        message={`Hi ${visitor.fullName}, thanks for visiting us today.`}
                      />
                    ) : null}
                    {visitor.status === "CHECKED_IN" ? (
                      <form action={checkOutVisitorAction}>
                        <input type="hidden" name="visitorId" value={visitor.id} />
                        <button
                          type="submit"
                          className="admin-focus rounded-full border border-[var(--line)] px-3 py-1 text-xs font-medium text-[var(--ink-700)] transition-colors hover:bg-[var(--sand-100,#f1f5f9)]"
                        >
                          Check out
                        </button>
                      </form>
                    ) : (
                      <span className="rounded-full bg-[var(--sand-100,#f1f5f9)] px-2.5 py-1 text-xs font-medium text-[var(--ink-500)]">
                        Checked out
                      </span>
                    )}
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>

        {/* Calls column */}
        <section className="rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--surface-1,#fff)] p-5 shadow-[var(--shadow-sm)] sm:p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--ink-950)]">
            <Phone className="h-[18px] w-[18px] text-[var(--ink-500)]" aria-hidden /> Log a call
          </h2>
          <form action={logCallAction} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input name="callerName" required placeholder="Caller name *" className={inputClass} aria-label="Caller name" />
            <input name="phone" placeholder="Phone" className={inputClass} aria-label="Caller phone" />
            <Select name="direction" defaultValue="INBOUND" className="w-full" aria-label="Call direction">
              <option value="INBOUND">Inbound</option>
              <option value="OUTBOUND">Outbound</option>
            </Select>
            <input name="purpose" placeholder="Reason for call" className={inputClass} aria-label="Reason for call" />
            <input name="outcome" placeholder="Outcome / next step" className={`${inputClass} sm:col-span-2`} aria-label="Call outcome" />
            <div className="sm:col-span-2">
              <button type="submit" className={buttonClass}>
                <Phone className="h-4 w-4" aria-hidden /> Log call
              </button>
            </div>
          </form>

          <ul className="mt-5 divide-y divide-[var(--line)]">
            {logbook.calls.length === 0 ? (
              <li className="py-6 text-center text-sm text-[var(--ink-500)]">No calls logged yet today.</li>
            ) : (
              logbook.calls.map((call) => (
                <li key={call.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--ink-900)]">{call.callerName}</p>
                    <p className="truncate text-xs text-[var(--ink-500)]">
                      {[call.purpose, call.outcome, call.when].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                      call.direction === "INBOUND"
                        ? "bg-[var(--brand-50,#eef2ff)] text-[var(--brand-700)]"
                        : "bg-[var(--sand-100,#f1f5f9)] text-[var(--ink-600)]"
                    }`}
                  >
                    {call.direction === "INBOUND" ? "Inbound" : "Outbound"}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
