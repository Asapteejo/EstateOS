import { DashboardShell } from "@/components/portal/dashboard-shell";
import { DataTableCard } from "@/components/shared/data-table-card";
import { requireAdminSession } from "@/lib/auth/guards";
import { getAdminPropertiesTable } from "@/modules/admin/queries";

export default async function AdminListingsPage() {
  const tenant = await requireAdminSession();
  const rows = await getAdminPropertiesTable(tenant);

  return (
    <DashboardShell area="admin" title="Listings Management" subtitle="Create, edit, archive, and manage inventory availability with room for unit-level controls.">
      <DataTableCard
        title="Properties"
        columns={["Listing", "Type", "Status", "City", "Inquiries"]}
        rows={rows}
      />
    </DashboardShell>
  );
}
