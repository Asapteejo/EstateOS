import { DashboardShell } from "@/components/portal/dashboard-shell";
import { Timeline } from "@/components/shared/timeline";
import { Card } from "@/components/ui/card";
import { requirePortalSession } from "@/lib/auth/guards";
import { getBuyerTimeline } from "@/modules/portal/queries";

export default async function PortalTimelinePage() {
  const tenant = await requirePortalSession();
  const timeline = await getBuyerTimeline(tenant);

  return (
    <DashboardShell area="portal" title="Transaction Timeline" subtitle="Milestone visibility for buyers, legal, finance, and internal operations.">
      <Card className="p-8">
        <Timeline items={timeline} />
      </Card>
    </DashboardShell>
  );
}
