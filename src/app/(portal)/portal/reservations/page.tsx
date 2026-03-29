import { DashboardShell } from "@/components/portal/dashboard-shell";
import { DataTableCard } from "@/components/shared/data-table-card";
import { requirePortalSession } from "@/lib/auth/guards";
import { getBuyerReservationsTable } from "@/modules/portal/queries";

export default async function PortalReservationsPage() {
  const tenant = await requirePortalSession();
  const rows = await getBuyerReservationsTable(tenant);

  return (
    <DashboardShell area="portal" title="Reservations" subtitle="Reservation records, expiries, and property hold status.">
      <DataTableCard
        title="Reservation records"
        columns={["Reference", "Property", "Status", "Reserved until"]}
        rows={rows}
      />
    </DashboardShell>
  );
}
