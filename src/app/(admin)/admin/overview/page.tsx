import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requireAdminSession } from "@/lib/auth/guards";
import { filterAdminNav, rolesForAdminPath } from "@/lib/auth/admin-sections";
import { ExecutiveOverviewBoard } from "@/components/admin/executive-overview-board";
import { OwnerActivityFeed } from "@/components/admin/owner-activity-feed";
import { SectionDirectory } from "@/components/dashboard/section-directory";
import { getExecutiveOverview } from "@/modules/admin/executive-overview";
import { getOwnerActivityFeed } from "@/modules/admin/activity-feed";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const tenant = await requireAdminSession(rolesForAdminPath("/admin/overview"));
  const [overview, activity] = await Promise.all([
    getExecutiveOverview(tenant),
    getOwnerActivityFeed(tenant),
  ]);
  const sections = filterAdminNav(tenant.roles).map((item) => ({
    label: item.label,
    href: item.href,
  }));

  return (
    <DashboardShell
      area="admin"
      title="Executive Overview"
      subtitle="Company-wide health across sales, finance, and the front desk — at a glance."
    >
      <ExecutiveOverviewBoard overview={overview} />
      <OwnerActivityFeed items={activity} />
      <SectionDirectory items={sections} />
    </DashboardShell>
  );
}
