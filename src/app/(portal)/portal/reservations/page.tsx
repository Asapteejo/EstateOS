import { DashboardShell } from "@/components/portal/dashboard-shell";
import { ReservationsBoard } from "@/components/portal/reservations-board";
import { requirePortalSession } from "@/lib/auth/guards";
import { getBuyerReservationsTable } from "@/modules/portal/queries";

export const dynamic = "force-dynamic";

export default async function PortalReservationsPage() {
  const tenant = await requirePortalSession();
  const rows = await getBuyerReservationsTable(tenant);

  return (
    <DashboardShell
      area="portal"
      title="Reservations"
      subtitle="Units you've reserved, their hold status, and what's converted to a sale."
    >
      <ReservationsBoard rows={rows} />
    </DashboardShell>
  );
}
