import { DashboardShell } from "@/components/portal/dashboard-shell";
import { DataTableCard } from "@/components/shared/data-table-card";
import { requireAdminSession } from "@/lib/auth/guards";
import { getAdminNotificationsTable } from "@/modules/admin/queries";

export default async function AdminNotificationsPage() {
  const tenant = await requireAdminSession();
  const rows = await getAdminNotificationsTable(tenant);

  return (
    <DashboardShell area="admin" title="Notifications" subtitle="Campaigns, transactional templates, and operator-triggered notifications scaffold.">
      <DataTableCard
        title="Recent notifications"
        columns={["Title", "Channel", "Recipient", "State", "Created"]} 
        rows={rows}
      />
    </DashboardShell>
  );
}
