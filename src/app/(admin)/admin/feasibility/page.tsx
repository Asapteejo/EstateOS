import { FeasibilityProjectHub } from "@/components/admin/feasibility-project-hub";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requireAdminSession } from "@/lib/auth/guards";
import { getDevelopmentCalculationWorkspace } from "@/modules/development-calculations/service";

export default async function AdminFeasibilityPage() {
  const tenant = await requireAdminSession(["ADMIN"]);
  const workspace = await getDevelopmentCalculationWorkspace(tenant);

  return (
    <DashboardShell
      area="admin"
      title="Feasibility & planning"
      subtitle="Manage saved land-development models, open active workspaces, and move into decision review without overloading one screen."
    >
      <FeasibilityProjectHub
        calculations={workspace.calculations}
        defaultCurrency={workspace.defaultCurrency}
      />
    </DashboardShell>
  );
}
