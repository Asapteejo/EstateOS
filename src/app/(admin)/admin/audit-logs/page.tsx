import { DashboardShell } from "@/components/portal/dashboard-shell";
import { DataTableCard } from "@/components/shared/data-table-card";
import { requireAdminSession } from "@/lib/auth/guards";
import { getAdminAuditLogsTable } from "@/modules/admin/queries";

export default async function AdminAuditLogsPage() {
  const tenant = await requireAdminSession();
  const rows = await getAdminAuditLogsTable(tenant);

  return (
    <DashboardShell area="admin" title="Audit Logs" subtitle="Staff accountability and traceability for high-sensitivity actions.">
      <DataTableCard
        title="Audit trail"
        columns={["Actor", "Action", "Target", "Time"]}
        rows={rows}
      />
    </DashboardShell>
  );
}
