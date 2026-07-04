import { DealBoardView } from "@/components/admin/deal-board-view";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requireAdminSession } from "@/lib/auth/guards";
import { rolesForAdminPath } from "@/lib/auth/admin-sections";
import { getAdminDealBoard } from "@/modules/admin/deal-board";

export default async function AdminPipelinePage() {
  const tenant = await requireAdminSession(rolesForAdminPath("/admin/pipeline"));
  const board = await getAdminDealBoard(tenant);

  return (
    <DashboardShell
      area="admin"
      title="Sales Pipeline"
      subtitle="The same deal system, focused on the buyer stages that create or delay revenue."
    >
      <DealBoardView board={board} />
    </DashboardShell>
  );
}
