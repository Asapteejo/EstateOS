import { DashboardShell } from "@/components/portal/dashboard-shell";
import { DataTableCard } from "@/components/shared/data-table-card";
import { requirePortalSession } from "@/lib/auth/guards";
import { getBuyerPaymentsTable } from "@/modules/portal/queries";

export default async function PortalPaymentsPage() {
  const tenant = await requirePortalSession();
  const rows = await getBuyerPaymentsTable(tenant);

  return (
    <DashboardShell area="portal" title="Payments" subtitle="Verified payments, receipts, and provider-level tracking live here.">
      <DataTableCard
        title="Payment history"
        columns={["Reference", "Amount", "Status", "Method"]}
        rows={rows}
      />
    </DashboardShell>
  );
}
