import { DealBoardView } from "@/components/admin/deal-board-view";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requireAdminSession } from "@/lib/auth/guards";
import { getAdminDealBoard } from "@/modules/admin/deal-board";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tenant = await requireAdminSession(["ADMIN"]);
  const params = await searchParams;
  const board = await getAdminDealBoard(tenant);
  const setupMode =
    typeof params.mode === "string" && (params.mode === "sample" || params.mode === "clean")
      ? params.mode
      : null;
  const workspaceName = typeof params.workspace === "string" ? params.workspace : null;
  const showSuccess = params.setup === "ready";
  const highlightDealId = typeof params.highlight === "string" ? params.highlight : null;

  return (
    <DashboardShell
      area="admin"
      title="Deal Board"
      subtitle="Track every buyer from first inquiry to final payment. See what is paid, what is overdue, and what needs follow-up next."
    >
      <DealBoardView
        board={board}
        highlightDealId={highlightDealId}
        launch={{
          workspaceName,
          workspaceSlug: tenant.companySlug ?? null,
          setupMode,
          showSuccess,
        }}
      />
    </DashboardShell>
  );
}

