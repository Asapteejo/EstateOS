import { DevelopmentCalculatorWorkspace } from "@/components/admin/development-calculator-workspace";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requireAdminSession } from "@/lib/auth/guards";
import type { DevelopmentPresetKey } from "@/modules/development-calculations/presets";
import { getDevelopmentCalculationWorkspace } from "@/modules/development-calculations/service";

const VALID_PRESETS: DevelopmentPresetKey[] = ["AGGRESSIVE", "BALANCED", "CONSERVATIVE"];

export default async function AdminFeasibilityNewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tenant = await requireAdminSession(["ADMIN"]);
  const workspace = await getDevelopmentCalculationWorkspace(tenant);
  const { preset } = await searchParams;
  const resolvedPreset = typeof preset === "string" && VALID_PRESETS.includes(preset as DevelopmentPresetKey)
    ? (preset as DevelopmentPresetKey)
    : "BALANCED";

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
        initialPreset={resolvedPreset}
      />
    </DashboardShell>
  );
}
