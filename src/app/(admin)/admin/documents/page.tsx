import { KycReviewManager } from "@/components/admin/kyc-review-manager";
import { DataTableCard } from "@/components/shared/data-table-card";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requireAdminSession } from "@/lib/auth/guards";
import { getAdminDocumentsTable } from "@/modules/admin/queries";
import { getAdminKycReviewQueue } from "@/modules/kyc/service";

export default async function AdminDocumentsPage() {
  const tenant = await requireAdminSession();
  const [rows, reviewQueue] = await Promise.all([
    getAdminDocumentsTable(tenant),
    getAdminKycReviewQueue(tenant),
  ]);

  return (
    <DashboardShell
      area="admin"
      title="Document Review"
      subtitle="Private document metadata, review states, and buyer compliance actions."
    >
      <div className="space-y-6">
        <KycReviewManager items={reviewQueue} />
        <DataTableCard
          title="Document register"
          columns={["File", "Owner", "Type", "Status"]}
          rows={rows}
        />
      </div>
    </DashboardShell>
  );
}
