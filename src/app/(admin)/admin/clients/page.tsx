import { DashboardShell } from "@/components/portal/dashboard-shell";
import { DataTableCard } from "@/components/shared/data-table-card";
import { requireAdminSession } from "@/lib/auth/guards";
import { getAdminClientsTable } from "@/modules/admin/queries";

export default async function AdminClientsPage() {
  const tenant = await requireAdminSession();
  const rows = await getAdminClientsTable(tenant);

  return (
    <DashboardShell area="admin" title="Clients" subtitle="Buyer profiles, staff assignment, and KYC state.">
      <DataTableCard
        title="Client table"
        columns={["Client", "Stage", "Assigned staff", "KYC"]}
        rows={rows}
      />
    </DashboardShell>
  );
}
