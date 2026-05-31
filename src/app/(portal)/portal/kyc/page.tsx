import { KycSubmissionManager } from "@/components/portal/kyc-submission-manager";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requirePortalSession } from "@/lib/auth/guards";
import { getAppSession } from "@/lib/auth/session";
import { getBuyerKycWorkspace } from "@/modules/kyc/service";

export default async function PortalKycPage() {
  const tenant = await requirePortalSession();
  const session = await getAppSession("portal");
  const workspace = await getBuyerKycWorkspace(tenant, { email: session?.email });

  return (
    <DashboardShell
      area="portal"
      title="KYC Documents"
      subtitle="Upload and track private verification documents required for reservation, legal review, and completion."
    >
      <KycSubmissionManager
        overallStatus={workspace.overallStatus}
        profileReady={workspace.profileReady}
        profileChecklist={workspace.profileChecklist}
        buyerCountry={workspace.buyerCountry}
        submissions={workspace.submissions}
      />
    </DashboardShell>
  );
}
