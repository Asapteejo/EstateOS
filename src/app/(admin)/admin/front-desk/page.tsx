import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requireAdminSession } from "@/lib/auth/guards";
import { filterAdminNav, rolesForAdminPath } from "@/lib/auth/admin-sections";
import { FrontDeskBoard } from "@/components/admin/front-desk-board";
import { SectionDirectory } from "@/components/dashboard/section-directory";
import { getFrontDeskOverview } from "@/modules/front-desk/service";

export const dynamic = "force-dynamic";

export default async function AdminFrontDeskPage() {
  const tenant = await requireAdminSession(rolesForAdminPath("/admin/front-desk"));
  const overview = await getFrontDeskOverview(tenant);
  const sections = filterAdminNav(tenant.roles).map((item) => ({
    label: item.label,
    href: item.href,
  }));

  return (
    <DashboardShell
      area="admin"
      title="Front Desk"
      subtitle="Walk-ins, viewings, and the day's incoming leads at a glance."
    >
      <FrontDeskBoard overview={overview} />
      <SectionDirectory items={sections} />
    </DashboardShell>
  );
}
