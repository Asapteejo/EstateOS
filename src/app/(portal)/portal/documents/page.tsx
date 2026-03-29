import { DashboardShell } from "@/components/portal/dashboard-shell";
import { DataTableCard } from "@/components/shared/data-table-card";
import { requirePortalSession } from "@/lib/auth/guards";
import { getBuyerDocumentsTable } from "@/modules/portal/queries";

export default async function PortalDocumentsPage() {
  const tenant = await requirePortalSession();
  const rows = await getBuyerDocumentsTable(tenant);

  return (
    <DashboardShell area="portal" title="Document Vault" subtitle="Receipts, agreements, KYC files, and downloadable transaction records.">
      <DataTableCard
        title="Documents"
        columns={["File", "Type", "Visibility", "Updated"]}
        rows={rows}
      />
    </DashboardShell>
  );
}
