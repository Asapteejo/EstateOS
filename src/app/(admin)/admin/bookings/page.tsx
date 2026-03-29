import { DashboardShell } from "@/components/portal/dashboard-shell";
import { DataTableCard } from "@/components/shared/data-table-card";
import { requireAdminSession } from "@/lib/auth/guards";
import { getAdminBookingsTable } from "@/modules/admin/queries";

export default async function AdminBookingsPage() {
  const tenant = await requireAdminSession();
  const rows = await getAdminBookingsTable(tenant);

  return (
    <DashboardShell area="admin" title="Inspections & Bookings" subtitle="Inspection scheduling, approvals, and status tracking.">
      <DataTableCard
        title="Booking table"
        columns={["Client", "Property", "Date", "Status"]}
        rows={rows}
      />
    </DashboardShell>
  );
}
