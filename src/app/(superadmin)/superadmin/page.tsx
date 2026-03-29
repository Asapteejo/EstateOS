import Link from "next/link";

import { Card } from "@/components/ui/card";
import { DataTableCard } from "@/components/shared/data-table-card";
import { SuperadminShell } from "@/components/superadmin/superadmin-shell";
import { requireSuperAdminSession } from "@/lib/auth/guards";
import { getSuperadminDashboardData } from "@/modules/superadmin/queries";

export default async function SuperadminDashboardPage() {
  await requireSuperAdminSession();
  const dashboard = await getSuperadminDashboardData();

  return (
    <SuperadminShell
      title="EstateOS Platform Dashboard"
      subtitle="Platform-wide subscription, payout, commission, and company health visibility across all tenants."
    >
      <div className="grid gap-6 md:grid-cols-3 xl:grid-cols-5">
        {dashboard.metrics.map((metric) => (
          <Card key={metric.label} className="p-6">
            <div className="text-sm text-[var(--ink-500)]">{metric.label}</div>
            <div className="mt-3 text-3xl font-semibold text-[var(--ink-950)]">{metric.value}</div>
            <div className="mt-2 text-sm text-[var(--brand-700)]">{metric.detail}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <DataTableCard
          title="Recent billing events"
          columns={["Company", "Event", "Summary", "Time"]}
          rows={dashboard.recentBillingEvents}
        />
        <DataTableCard
          title="Recent payment events"
          columns={["Company", "Reference", "Amount", "Status"]}
          rows={dashboard.recentPaymentEvents}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <DataTableCard
            title="Recent audit events"
            columns={["Company", "Action", "Entity", "Time"]}
            rows={dashboard.recentAuditEvents}
          />
          <DataTableCard
            title="Companies by plan"
            columns={["Plan", "Companies"]}
            rows={dashboard.companiesByPlan.map((item) => [item.label, String(item.count)])}
          />
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-[var(--line)] px-6 py-4">
            <h3 className="text-lg font-semibold text-[var(--ink-950)]">Company health</h3>
            <p className="mt-1 text-sm text-[var(--ink-500)]">
              Drill into tenant billing state, payout readiness, and transaction performance.
            </p>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {dashboard.companies.map((company) => (
              <div
                key={company.companyId}
                className="grid gap-4 px-6 py-5 lg:grid-cols-[1.1fr_0.9fr_0.9fr_auto]"
              >
                <div>
                  <div className="font-semibold text-[var(--ink-950)]">{company.companyName}</div>
                  <div className="mt-1 text-sm text-[var(--ink-500)]">{company.companySlug}</div>
                </div>
                <div className="text-sm text-[var(--ink-700)]">
                  <div>{company.planLabel}</div>
                  <div className="mt-1 text-[var(--ink-500)]">{company.subscriptionStatus}</div>
                </div>
                <div className="text-sm text-[var(--ink-700)]">
                  <div>{company.transactionVolume}</div>
                  <div className="mt-1 text-[var(--ink-500)]">{company.payoutReadiness}</div>
                </div>
                <div className="flex justify-end">
                  <Link
                    href={`/superadmin/companies/${company.companyId}`}
                    className="rounded-2xl border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink-700)] transition hover:bg-[var(--sand-100)]"
                  >
                    Inspect
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </SuperadminShell>
  );
}
