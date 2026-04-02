import { DashboardShell } from "@/components/portal/dashboard-shell";
import { SettingsManagement } from "@/components/admin/settings-management";
import { requireAdminSession } from "@/lib/auth/guards";
import { getTenantAdminSettings } from "@/modules/settings/service";

export default async function AdminSettingsPage() {
  const tenant = await requireAdminSession(["ADMIN"]);
  const settings = await getTenantAdminSettings(tenant);

  return (
    <DashboardShell
      area="admin"
      title="Settings"
      subtitle="Manage tenant branding, defaults, payment display rules, and public staff visibility without developer intervention."
    >
      <SettingsManagement settings={settings} />
    </DashboardShell>
  );
}
