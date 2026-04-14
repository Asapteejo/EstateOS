import { AdminMetricCard, AdminMetricGrid, AdminToolbar } from "@/components/admin/admin-ui";
import { TransactionManagement } from "@/components/admin/transaction-management";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { DataTableCard } from "@/components/shared/data-table-card";
import { Button } from "@/components/ui/button";
import { requireAdminSession } from "@/lib/auth/guards";
import { formatCurrency } from "@/lib/utils";
import { getAdminTransactionsTable } from "@/modules/admin/queries";
import {
  getAdminTransactionManagementList,
  mapAdminTransactionsForTable,
} from "@/modules/admin/operations";

export default async function AdminTransactionsPage() {
  const tenant = await requireAdminSession();
  const [rows, managementRows] = await Promise.all([
    getAdminTransactionsTable(tenant),
    getAdminTransactionManagementList(tenant),
  ]);
  const tableItems = mapAdminTransactionsForTable(managementRows);

  const stagedTransactions = tableItems.filter((row) => row.stage !== "HANDOVER_COMPLETED").length;
  const totalOutstanding = tableItems.reduce((sum, row) => sum + row.balance, 0);
  const activeReservations = tableItems.filter((row) => row.reservationStatus === "ACTIVE").length;

  return (
    <DashboardShell
      area="admin"
      title="Transactions"
      subtitle="Manage reservation conversion, transaction stages, and buyer-facing milestone progress."
    >
      <AdminToolbar>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">
            Transaction operations
          </div>
          <p className="mt-1 text-sm leading-6 text-[var(--ink-500)]">
            Keep stage movement and reservation status aligned with buyer-facing milestones.
          </p>
        </div>
        <a href="/api/admin/exports/transactions">
          <Button variant="outline">Export transactions CSV</Button>
        </a>
      </AdminToolbar>

      <AdminMetricGrid>
        <AdminMetricCard
          label="Tracked transactions"
          value={managementRows.length}
          hint="Reservations already promoted into the transaction workflow."
        />
        <AdminMetricCard
          label="Open stages"
          value={stagedTransactions}
          hint="Transactions still moving toward final payment or handover."
        />
        <AdminMetricCard
          label="Active reservations"
          value={activeReservations}
          hint="Reservation records currently marked active."
        />
        <AdminMetricCard
          label="Outstanding balance"
          value={formatCurrency(totalOutstanding)}
          hint="Total unpaid balance across the current transaction set."
          tone={totalOutstanding > 0 ? "accent" : "success"}
        />
      </AdminMetricGrid>

      <div className="space-y-6">
        <TransactionManagement items={tableItems} />
        <DataTableCard
          title="Transactions register"
          columns={["Reference", "Property", "Buyer", "Marketer", "Stage", "Balance"]}
          rows={rows}
        />
      </div>
    </DashboardShell>
  );
}
