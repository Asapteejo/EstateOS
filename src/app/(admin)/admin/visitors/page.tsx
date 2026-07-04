import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requireAdminSession } from "@/lib/auth/guards";
import { rolesForAdminPath } from "@/lib/auth/admin-sections";
import { FrontDeskLogbookView } from "@/components/admin/front-desk-logbook";
import { getFrontDeskLogbook } from "@/modules/front-desk/logbook";

export const dynamic = "force-dynamic";

export default async function AdminVisitorsPage() {
  const tenant = await requireAdminSession(rolesForAdminPath("/admin/visitors"));
  const logbook = await getFrontDeskLogbook(tenant);

  return (
    <DashboardShell
      area="admin"
      title="Visitor & Call Log"
      subtitle="Check walk-in visitors in and out, and keep a record of every phone call at the front desk."
    >
      <FrontDeskLogbookView logbook={logbook} />
    </DashboardShell>
  );
}
