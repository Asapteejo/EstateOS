import { CalendarClock, Users2, Flame } from "lucide-react";

import { AdminEmptyState, AdminStateBanner, StatCard } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { WhatsAppButton } from "@/components/shared/whatsapp-button";
import type { MarketerDashboard } from "@/modules/marketer/dashboard";

export function MarketerDashboardView({ data }: { data: MarketerDashboard }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Assigned leads" value={String(data.stats.assignedLeads)} />
        <StatCard label="Open leads" value={String(data.stats.openLeads)} />
        <StatCard label="Upcoming inspections" value={String(data.stats.upcomingInspections)} />
      </div>

      {!data.hasProfile ? (
        <AdminStateBanner
          tone="info"
          title="No marketer profile linked yet"
          message="Once an admin links your account to a marketer profile and assigns you leads, your pipeline and viewings will appear here."
        />
      ) : null}

      <Card className="admin-surface p-6">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-[var(--ink-950)]">
          <Users2 className="h-5 w-5 text-[var(--ink-500)]" aria-hidden /> My assigned leads
        </h2>
        <div className="mt-5 space-y-3">
          {data.leads.length === 0 ? (
            <AdminEmptyState
              title="No leads assigned"
              description="Leads assigned to you will show up here so you can follow up fast."
            />
          ) : (
            data.leads.map((lead) => (
              <div
                key={lead.id}
                className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle,var(--line))] bg-white p-4 shadow-[var(--shadow-xs)] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--ink-950)]">{lead.name}</div>
                  <div className="mt-0.5 truncate text-sm text-[var(--ink-500)]">{lead.propertyTitle}</div>
                  <div className="numeric mt-1 text-xs uppercase tracking-[0.14em] text-[var(--ink-400)]">{lead.when}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge className="whitespace-nowrap">{lead.status}</Badge>
                  {lead.phone ? (
                    <WhatsAppButton
                      phone={lead.phone}
                      message={`Hi ${lead.name}, this is your agent regarding ${lead.propertyTitle}.`}
                    />
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="admin-surface p-6">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-[var(--ink-950)]">
          <CalendarClock className="h-5 w-5 text-[var(--ink-500)]" aria-hidden /> My inspections
        </h2>
        <div className="mt-5 space-y-3">
          {data.inspections.length === 0 ? (
            <AdminEmptyState
              title="No inspections scheduled"
              description="Viewings assigned to you will appear here with the buyer's details."
            />
          ) : (
            data.inspections.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle,var(--line))] bg-white p-4 shadow-[var(--shadow-xs)] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--ink-950)]">{item.name}</div>
                  <div className="mt-0.5 truncate text-sm text-[var(--ink-500)]">{item.propertyTitle}</div>
                  <div className="numeric mt-1 flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-[var(--ink-400)]">
                    <Flame className="h-3 w-3" aria-hidden /> {item.when}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge className="whitespace-nowrap">{item.status}</Badge>
                  {item.phone ? (
                    <WhatsAppButton
                      phone={item.phone}
                      message={`Hi ${item.name}, confirming your viewing of ${item.propertyTitle}.`}
                    />
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
