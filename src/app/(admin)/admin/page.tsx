import { DashboardShell } from "@/components/portal/dashboard-shell";
import { DataTableCard } from "@/components/shared/data-table-card";
import { Card } from "@/components/ui/card";
import { requireAdminSession } from "@/lib/auth/guards";
import { getAdminDashboardSummary } from "@/modules/admin/queries";

export default async function AdminDashboardPage() {
  const tenant = await requireAdminSession();
  const summary = await getAdminDashboardSummary(tenant);

  return (
    <DashboardShell area="admin" title="Admin Dashboard" subtitle="Operations, sales, payments, documents, and auditability in one internal workspace.">
      <div className="grid gap-6 md:grid-cols-3">
        {summary.metrics.map((metric) => (
          <Card key={metric.label} className="p-6">
            <div className="text-sm text-[var(--ink-500)]">{metric.label}</div>
            <div className="mt-3 text-3xl font-semibold text-[var(--ink-950)]">{metric.value}</div>
            <div className="mt-2 text-sm text-[var(--brand-700)]">{metric.delta}</div>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <DataTableCard
          title="Top active deals"
          columns={["Reference", "Property", "Buyer", "Status", "Balance"]}
          rows={summary.topDeals}
        />
        <div className="space-y-6">
          <DataTableCard
            title="Top listings"
            columns={["Listing", "Inquiries"]}
            rows={summary.topListings}
          />
          <DataTableCard
            title="Top staff"
            columns={["Staff", "Assigned leads"]}
            rows={summary.topStaff}
          />
        </div>
      </div>
    </DashboardShell>
  );
}
