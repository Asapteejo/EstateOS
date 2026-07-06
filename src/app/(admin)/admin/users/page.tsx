import { DashboardShell } from "@/components/portal/dashboard-shell";
import { UsersManagement } from "@/components/admin/users-management";
import { requireAdminSession } from "@/lib/auth/guards";
import { rolesForAdminPath } from "@/lib/auth/admin-sections";
import { getCompanyUsers } from "@/modules/admin/users";

export default async function AdminUsersPage() {
  const tenant = await requireAdminSession(rolesForAdminPath("/admin/users"));
  const users = await getCompanyUsers(tenant);

  return (
    <DashboardShell
      area="admin"
      title="Users"
      subtitle="Manage staff accounts for your company — view profiles, suspend access, or remove accounts."
    >
      <UsersManagement users={users} />
    </DashboardShell>
  );
}
