import { notFound } from "next/navigation";

import { DevelopmentCalculatorWorkspace } from "@/components/admin/development-calculator-workspace";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requireAdminSession } from "@/lib/auth/guards";
import { getDevelopmentCalculationWorkspace } from "@/modules/development-calculations/service";

export default async function AdminFeasibilityDetailPage({
  params,
}: {
  params: Promise<{ calculationId: string }>;
}) {
  const tenant = await requireAdminSession(["ADMIN"]);
  const { calculationId } = await params;
  const workspace = await getDevelopmentCalculationWorkspace(tenant, calculationId);

  if (!workspace.selected) {
    notFound();
  }

  return (
    <DashboardShell
      area="admin"
      title="Land development calculator"
      subtitle="Focused modelling workspace for editing assumptions, testing scenarios, and saving new versions."
    >
      <DevelopmentCalculatorWorkspace
        calculations={workspace.calculations}
        selected={workspace.selected}
        versions={workspace.versions}
        blankForm={workspace.blankForm}
        defaultCurrency={workspace.defaultCurrency}
        showProjectBrowser={false}
        allowPresentationView={false}
        decisionHref={`/admin/feasibility/${calculationId}/decision`}
      />
    </DashboardShell>
  );
}
