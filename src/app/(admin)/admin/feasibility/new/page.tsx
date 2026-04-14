import { DevelopmentCalculatorWorkspace } from "@/components/admin/development-calculator-workspace";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requireAdminSession } from "@/lib/auth/guards";
import { getDevelopmentCalculationWorkspace } from "@/modules/development-calculations/service";

export default async function AdminFeasibilityNewPage() {
  const tenant = await requireAdminSession(["ADMIN"]);
  const workspace = await getDevelopmentCalculationWorkspace(tenant);

  return (
    <DashboardShell
      area="admin"
      title="New land development model"
      subtitle="Start a fresh feasibility model without the saved-project browser competing with the editor."
    >
      <DevelopmentCalculatorWorkspace
        calculations={workspace.calculations}
        selected={null}
        versions={[]}
        blankForm={workspace.blankForm}
        defaultCurrency={workspace.defaultCurrency}
        showProjectBrowser={false}
        allowPresentationView={false}
      />
    </DashboardShell>
  );
}
