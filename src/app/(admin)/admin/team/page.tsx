import { DashboardShell } from "@/components/portal/dashboard-shell";
import { TeamManagement } from "@/components/admin/team-management";
import { requireAdminSession } from "@/lib/auth/guards";
import { getAdminTeamMembers, getAvailableResumeDocuments } from "@/modules/team/queries";

export default async function AdminTeamPage() {
  const tenant = await requireAdminSession(["ADMIN"]);
  const [members, resumeDocuments] = await Promise.all([
    getAdminTeamMembers(tenant),
    getAvailableResumeDocuments(tenant),
  ]);

  return (
    <DashboardShell
      area="admin"
      title="Staff Directory"
      subtitle="Manage the public-facing staff and marketer profiles your company presents to buyers and prospects."
    >
      <TeamManagement members={members} resumeDocuments={resumeDocuments} />
    </DashboardShell>
  );
}
