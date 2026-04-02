import Link from "next/link";

import { AutomationRunnerButton } from "@/components/admin/automation-runner-button";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { DataTableCard } from "@/components/shared/data-table-card";
import { Card } from "@/components/ui/card";
import { requireAdminSession } from "@/lib/auth/guards";
import { getAdminControlCenter } from "@/modules/admin/control-center";

export default async function AdminDashboardPage() {
  const tenant = await requireAdminSession(["ADMIN"]);
  const dashboard = await getAdminControlCenter(tenant);

  return (
    <DashboardShell
      area="admin"
      title="Today Dashboard"
      subtitle="Start here every day: follow-ups, inspection queue, overdue money, listing trust, and the next actions that move deals forward."
    >
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--ink-950)]">Today&apos;s actions</h2>
          <AutomationRunnerButton />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {dashboard.todayActions.map((item) => (
            <Link key={item.label} href={item.href}>
              <Card className="rounded-[28px] border-[var(--line)] bg-white p-5 transition hover:-translate-y-0.5">
                <div className="text-sm text-[var(--ink-500)]">{item.label}</div>
                <div className="mt-3 text-3xl font-semibold text-[var(--ink-950)]">{item.value}</div>
                <div className="mt-2 text-sm text-[var(--brand-700)]">{item.detail}</div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-[30px] border-[var(--line)] bg-white p-6">
          <h2 className="text-lg font-semibold text-[var(--ink-950)]">Pipeline snapshot</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {dashboard.pipelineSnapshot.map(([label, value, href]) => (
              <Link key={label} href={href}>
                <div className="rounded-3xl bg-[var(--sand-100)] p-4">
                  <div className="text-sm text-[var(--ink-500)]">{label}</div>
                  <div className="mt-2 text-2xl font-semibold text-[var(--ink-950)]">{value}</div>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="rounded-[30px] border-[var(--line)] bg-white p-6">
          <h2 className="text-lg font-semibold text-[var(--ink-950)]">Quick actions</h2>
          <div className="mt-5 grid gap-3">
            {dashboard.quickActions.map((item) => (
              <Link key={item.label} href={item.href}>
                <div className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm font-medium text-[var(--ink-700)] transition hover:bg-[var(--sand-100)]">
                  {item.label}
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DataTableCard
          title="Upcoming inspections"
          columns={["Client", "Property", "Scheduled for"]}
          rows={dashboard.upcomingRows}
        />
        <DataTableCard
          title="Urgent payment recovery"
          columns={["Reference", "Buyer", "Outstanding"]}
          rows={dashboard.urgentRows}
        />
      </div>

      <Card className="rounded-[30px] border-[var(--line)] bg-white p-6">
        <h2 className="text-lg font-semibold text-[var(--ink-950)]">Urgent alerts</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          {dashboard.urgentAlerts.map(([label, value, href]) => (
            <Link key={label} href={href}>
              <div className="rounded-3xl border border-[var(--line)] p-4">
                <div className="text-sm text-[var(--ink-500)]">{label}</div>
                <div className="mt-2 text-2xl font-semibold text-[var(--ink-950)]">{value}</div>
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </DashboardShell>
  );
}

