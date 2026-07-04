import { DashboardShell } from "@/components/portal/dashboard-shell";
import { ScheduleAgenda } from "@/components/admin/schedule-agenda";
import { requireAdminSession } from "@/lib/auth/guards";
import { rolesForAdminPath } from "@/lib/auth/admin-sections";
import { getInspectionManagementList } from "@/modules/inspections/service";

export const dynamic = "force-dynamic";

export default async function AdminSchedulePage() {
  const tenant = await requireAdminSession(rolesForAdminPath("/admin/schedule"));
  const bookings = await getInspectionManagementList(tenant);

  return (
    <DashboardShell
      area="admin"
      title="Schedule"
      subtitle="Upcoming property viewings at a glance, grouped by day."
    >
      <ScheduleAgenda items={bookings} />
    </DashboardShell>
  );
}
