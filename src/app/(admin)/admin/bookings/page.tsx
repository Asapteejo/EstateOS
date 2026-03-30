import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requireAdminSession } from "@/lib/auth/guards";
import { InspectionManagement } from "@/components/admin/inspection-management";
import { getAssignableStaffOptions } from "@/modules/inquiries/service";
import { getInspectionManagementList } from "@/modules/inspections/service";

export default async function AdminBookingsPage() {
  const tenant = await requireAdminSession();
  const [bookings, staff] = await Promise.all([
    getInspectionManagementList(tenant),
    getAssignableStaffOptions(tenant),
  ]);

  return (
    <DashboardShell area="admin" title="Inspections & Bookings" subtitle="Inspection scheduling, approvals, and status tracking.">
      <InspectionManagement
        bookings={bookings}
        staffOptions={staff.map((member) => ({
          id: member.id,
          label:
            `${member.user.firstName ?? ""} ${member.user.lastName ?? ""}`.trim() ||
            member.title ||
            "Assignable staff",
        }))}
      />
    </DashboardShell>
  );
}
