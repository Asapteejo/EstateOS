import { DashboardShell } from "@/components/portal/dashboard-shell";
import { DataTableCard } from "@/components/shared/data-table-card";
import { requireAdminSession } from "@/lib/auth/guards";
import { getAdminTransactionsTable } from "@/modules/admin/queries";

export default async function AdminTransactionsPage() {
  const tenant = await requireAdminSession();
  const rows = await getAdminTransactionsTable(tenant);

  return (
    <DashboardShell area="admin" title="Transactions" subtitle="Reservation conversion, transaction stage updates, and outstanding balances.">
      <DataTableCard
        title="Transactions"
        columns={["Reference", "Property", "Buyer", "Stage", "Balance"]}
        rows={rows}
      />
    </DashboardShell>
  );
}
