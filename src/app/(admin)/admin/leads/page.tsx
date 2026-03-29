import { DashboardShell } from "@/components/portal/dashboard-shell";
import { DataTableCard } from "@/components/shared/data-table-card";
import { requireAdminSession } from "@/lib/auth/guards";
import { getAdminInquiriesTable } from "@/modules/admin/queries";

export default async function AdminLeadsPage() {
  const tenant = await requireAdminSession();
  const rows = await getAdminInquiriesTable(tenant);

  return (
    <DashboardShell area="admin" title="Leads & Inquiries" subtitle="Lead source, owner assignment, and pipeline qualification view.">
      <DataTableCard
        title="Inquiry table"
        columns={["Lead", "Property", "Source", "Status", "Owner"]}
        rows={rows}
      />
    </DashboardShell>
  );
}
