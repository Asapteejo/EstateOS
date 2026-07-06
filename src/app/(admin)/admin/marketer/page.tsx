import { DashboardShell } from "@/components/portal/dashboard-shell";
import { MarketerDashboardView } from "@/components/admin/marketer-dashboard";
import { requireAdminSession } from "@/lib/auth/guards";
import { rolesForAdminPath } from "@/lib/auth/admin-sections";
import { getMarketerDashboard } from "@/modules/marketer/dashboard";

export default async function AdminMarketerPage() {
  const tenant = await requireAdminSession(rolesForAdminPath("/admin/marketer"));
  const data = await getMarketerDashboard(tenant);

  return (
    <DashboardShell
      area="admin"
      title="My Dashboard"
      subtitle="Your assigned leads and viewings — follow up fast and keep deals moving."
    >
      <MarketerDashboardView data={data} />
    </DashboardShell>
  );
}
