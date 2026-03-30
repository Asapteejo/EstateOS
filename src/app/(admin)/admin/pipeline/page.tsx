import Link from "next/link";

import { DashboardShell } from "@/components/portal/dashboard-shell";
import { DataTableCard } from "@/components/shared/data-table-card";
import { Card } from "@/components/ui/card";
import { requireAdminSession } from "@/lib/auth/guards";
import { getAdminSalesPipeline } from "@/modules/admin/queries";

export default async function AdminPipelinePage() {
  const tenant = await requireAdminSession();
  const pipeline = await getAdminSalesPipeline(tenant);

  return (
    <DashboardShell
      area="admin"
      title="Sales Pipeline"
      subtitle="A tenant-scoped operational view of leads, inspections, reservations, payments, and completed deals."
    >
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
        {pipeline.cards.map((card) => (
          <Card key={card.label} className="p-6">
            <div className="text-sm text-[var(--ink-500)]">{card.label}</div>
            <div className="mt-3 text-3xl font-semibold text-[var(--ink-950)]">{card.count}</div>
            <div className="mt-2 text-sm text-[var(--brand-700)]">{card.detail}</div>
            <Link href={card.href} className="mt-4 inline-block text-sm font-medium text-[var(--ink-700)]">
              Open list
            </Link>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DataTableCard
          title="Recent leads"
          columns={["Lead", "Property", "Status", "Owner"]}
          rows={pipeline.recentLeads}
        />
        <DataTableCard
          title="Upcoming inspections"
          columns={["Client", "Property", "Scheduled", "Status"]}
          rows={pipeline.upcomingInspections}
        />
      </div>
    </DashboardShell>
  );
}
