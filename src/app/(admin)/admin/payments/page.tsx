import { DashboardShell } from "@/components/portal/dashboard-shell";
import { DataTableCard } from "@/components/shared/data-table-card";
import { requireAdminSession } from "@/lib/auth/guards";
import { getAdminPaymentsTable } from "@/modules/admin/queries";

export default async function AdminPaymentsPage() {
  const tenant = await requireAdminSession();
  const rows = await getAdminPaymentsTable(tenant);

  return (
    <DashboardShell area="admin" title="Payments Monitoring" subtitle="Provider verification status, reconciliation, and receipt generation foundation.">
      <DataTableCard
        title="Payments"
        columns={["Reference", "Buyer", "Amount", "Status", "Method"]}
        rows={rows}
      />
    </DashboardShell>
  );
}
