import { SiteContentManagement } from "@/components/admin/site-content-management";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requireAdminSession } from "@/lib/auth/guards";
import { resolveTenantSiteContent } from "@/modules/cms/site-content";
import { getTenantSiteContentState } from "@/modules/cms/site-content-service";
import { getTenantAdminSettings } from "@/modules/settings/service";

export default async function AdminSiteContentPage() {
  const tenant = await requireAdminSession(["ADMIN"]);
  const [settings, state] = await Promise.all([
    getTenantAdminSettings(tenant),
    getTenantSiteContentState(tenant),
  ]);

  // The resolved fallback copy doubles as input placeholders so operators can see
  // exactly what renders when a field is left blank.
  const fallback = resolveTenantSiteContent({
    companyName: settings.companyName,
    startPurchaseHref: "/portal",
  });

  return (
    <DashboardShell
      area="admin"
      title="Site content"
      subtitle="Edit your public site copy — hero, calls to action, footer, and about — with draft preview and manual publish. Blank fields use a smart default."
    >
      <SiteContentManagement state={state} fallback={fallback} />
    </DashboardShell>
  );
}
