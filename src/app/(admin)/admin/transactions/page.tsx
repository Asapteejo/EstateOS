import { TransactionManagement } from "@/components/admin/transaction-management";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { DataTableCard } from "@/components/shared/data-table-card";
import { Button } from "@/components/ui/button";
import { requireAdminSession } from "@/lib/auth/guards";
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

  return (
    <DashboardShell
      area="admin"
      title="Transactions"
      subtitle="Manage reservation conversion, transaction stages, and buyer-facing milestone progress."
    >
      <div className="flex justify-end">
        <a href="/api/admin/exports/transactions">
          <Button variant="outline">Export transactions CSV</Button>
        </a>
      </div>
      <div className="space-y-6">
        <TransactionManagement items={mapAdminTransactionsForTable(managementRows)} />
        <DataTableCard
          title="Transactions register"
          columns={["Reference", "Property", "Buyer", "Marketer", "Stage", "Balance"]}
          rows={rows}
        />
      </div>
    </DashboardShell>
  );
}
