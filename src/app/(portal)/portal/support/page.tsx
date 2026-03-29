import { DashboardShell } from "@/components/portal/dashboard-shell";
import { EmptyState } from "@/components/shared/empty-state";

export default function PortalSupportPage() {
  return (
    <DashboardShell area="portal" title="Support" subtitle="Phase 2 support inbox and buyer chat scaffold.">
      <EmptyState
        title="Support chat scaffolded"
        description="Connect this route to a threaded support inbox or real-time chat in the next phase."
      />
    </DashboardShell>
  );
}
