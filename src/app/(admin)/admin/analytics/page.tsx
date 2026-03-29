import { DashboardShell } from "@/components/portal/dashboard-shell";
import { DataTableCard } from "@/components/shared/data-table-card";
import { Card } from "@/components/ui/card";
import { requireAdminSession } from "@/lib/auth/guards";
import { getAdminAnalyticsDetail } from "@/modules/admin/queries";

export default async function AdminAnalyticsPage() {
  const tenant = await requireAdminSession();
  const analytics = await getAdminAnalyticsDetail(tenant);

  return (
    <DashboardShell area="admin" title="Reports & Analytics" subtitle="KPI cards and chart placeholders for sales, conversion, listings, and staff performance.">
      <div className="grid gap-6 md:grid-cols-3">
        {analytics.cards.map(([title, value]) => (
          <Card key={title} className="h-72 p-6">
            <h3 className="text-lg font-semibold text-[var(--ink-950)]">{title}</h3>
            <div className="mt-6 flex h-[200px] items-center justify-center rounded-3xl bg-[var(--sand-100)] text-sm text-[var(--ink-500)]">
              {value}
            </div>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <DataTableCard
          title="Top listings"
          columns={["Listing", "Inquiries"]}
          rows={analytics.topListings}
        />
        <DataTableCard
          title="Top staff"
          columns={["Staff", "Assigned leads"]}
          rows={analytics.topStaff}
        />
      </div>
    </DashboardShell>
  );
}
