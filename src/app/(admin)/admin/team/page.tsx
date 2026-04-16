import { DashboardShell } from "@/components/portal/dashboard-shell";
import { TeamManagement } from "@/components/admin/team-management";
import { requireAdminSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { getAdminTeamMembers, getAvailableResumeDocuments } from "@/modules/team/queries";

export default async function AdminTeamPage() {
  const tenant = await requireAdminSession(["ADMIN"]);

  const [members, resumeDocuments, pendingInvitations] = await Promise.all([
    getAdminTeamMembers(tenant),
    getAvailableResumeDocuments(tenant),
    featureFlags.hasDatabase && tenant.companyId
      ? prisma.teamMemberInvitation.findMany({
          where: {
            companyId: tenant.companyId,
            status: "PENDING",
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            status: true,
            createdAt: true,
            expiresAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const serializedInvitations = pendingInvitations.map((inv) => ({
    ...inv,
    role: inv.role as string,
    status: inv.status as string,
    createdAt: inv.createdAt.toISOString(),
    expiresAt: inv.expiresAt.toISOString(),
  }));

  return (
    <DashboardShell
      area="admin"
      title="Staff Directory"
      subtitle="Manage the public-facing staff and marketer profiles your company presents to buyers and prospects."
    >
      <TeamManagement
        members={members}
        resumeDocuments={resumeDocuments}
        pendingInvitations={serializedInvitations}
      />
    </DashboardShell>
  );
}
