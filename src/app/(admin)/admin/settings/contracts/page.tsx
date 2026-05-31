import { requireAdminSession } from "@/lib/auth/guards";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { ContractSettingsManagement } from "@/components/admin/contract-settings-management";
import { getCompanyContractSettings, getCompanyContractTemplates } from "@/modules/contracts/service";

export default async function AdminContractSettingsPage() {
  const tenant = await requireAdminSession(["ADMIN", "LEGAL"]);
  const [settings, templates] = await Promise.all([
    getCompanyContractSettings(tenant),
    tenant.companyId ? getCompanyContractTemplates(tenant.companyId) : [],
  ]);

  return (
    <DashboardShell
      area="admin"
      title="Contract Settings"
      subtitle="Configure the authorized signatory, private stamp and signature assets, and tenant-approved Contract of Sale clauses."
    >
      <ContractSettingsManagement settings={settings} templates={templates} />
    </DashboardShell>
  );
}
