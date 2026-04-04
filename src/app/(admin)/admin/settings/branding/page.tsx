import { BrandingManagement } from "@/components/admin/branding-management";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requireAdminSession } from "@/lib/auth/guards";
import { getTenantBrandingState } from "@/modules/branding/service";
import { getTenantAdminSettings } from "@/modules/settings/service";

export default async function AdminBrandingSettingsPage() {
  const tenant = await requireAdminSession(["ADMIN"]);
  const [settings, brandingState] = await Promise.all([
    getTenantAdminSettings(tenant),
    getTenantBrandingState(tenant),
  ]);

  return (
    <DashboardShell
      area="admin"
      title="Branding Studio"
      subtitle="Design a controlled tenant brand system with draft preview, publish safeguards, and restrained application across admin and buyer surfaces."
    >
      <BrandingManagement state={brandingState} companyName={settings.companyName} />
    </DashboardShell>
  );
}
