import { DashboardShell } from "@/components/portal/dashboard-shell";
import { DataTableCard } from "@/components/shared/data-table-card";
import { requireAdminSession } from "@/lib/auth/guards";
import { getAdminDocumentsTable } from "@/modules/admin/queries";

export default async function AdminDocumentsPage() {
  const tenant = await requireAdminSession();
  const rows = await getAdminDocumentsTable(tenant);

  return (
    <DashboardShell area="admin" title="Document Review" subtitle="Private document metadata, review status, and controlled access foundation.">
      <DataTableCard
        title="Review queue"
        columns={["File", "Owner", "Type", "Status"]}
        rows={rows}
      />
    </DashboardShell>
  );
}
