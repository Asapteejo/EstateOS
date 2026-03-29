import { DashboardShell } from "@/components/portal/dashboard-shell";
import { TeamManagement } from "@/components/admin/team-management";
import { requireAdminSession } from "@/lib/auth/guards";
import { getAdminTeamMembers, getAvailableResumeDocuments } from "@/modules/team/queries";

export default async function AdminTeamPage() {
  const tenant = await requireAdminSession();
  const [members, resumeDocuments] = await Promise.all([
    getAdminTeamMembers(tenant),
    getAvailableResumeDocuments(tenant),
  ]);

  return (
    <DashboardShell
      area="admin"
      title="Team & Marketers"
      subtitle="Manage the visible staff profiles buyers can review and select during purchase flows."
    >
      <TeamManagement members={members} resumeDocuments={resumeDocuments} />
    </DashboardShell>
  );
}
