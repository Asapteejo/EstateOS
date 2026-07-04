import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requireAdminSession } from "@/lib/auth/guards";
import { filterAdminNav, rolesForAdminPath } from "@/lib/auth/admin-sections";
import { FinanceBoard } from "@/components/admin/finance-board";
import { SectionDirectory } from "@/components/dashboard/section-directory";
import { getFinanceOverview } from "@/modules/finance/service";

export const dynamic = "force-dynamic";

export default async function AdminFinancePage() {
  const tenant = await requireAdminSession(rolesForAdminPath("/admin/finance"));
  const overview = await getFinanceOverview(tenant);
  const sections = filterAdminNav(tenant.roles).map((item) => ({
    label: item.label,
    href: item.href,
  }));

  return (
    <DashboardShell
      area="admin"
      title="Finance"
      subtitle="Cash collected, outstanding balances, and the latest payments at a glance."
    >
      <FinanceBoard overview={overview} />
      <SectionDirectory items={sections} />
    </DashboardShell>
  );
}
