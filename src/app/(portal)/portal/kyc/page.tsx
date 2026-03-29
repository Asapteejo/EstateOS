import { KycSubmissionManager } from "@/components/portal/kyc-submission-manager";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requirePortalSession } from "@/lib/auth/guards";
import { getBuyerKycWorkspace } from "@/modules/kyc/service";

export default async function PortalKycPage() {
  const tenant = await requirePortalSession();
  const workspace = await getBuyerKycWorkspace(tenant);

  return (
    <DashboardShell
      area="portal"
      title="KYC Documents"
      subtitle="Upload and track private verification documents required for reservation, legal review, and completion."
    >
      <KycSubmissionManager
        overallStatus={workspace.overallStatus}
        submissions={workspace.submissions}
      />
    </DashboardShell>
  );
}
