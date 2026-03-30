import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requireAdminSession } from "@/lib/auth/guards";
import { InquiryManagement } from "@/components/admin/inquiry-management";
import { getAssignableStaffOptions, getInquiryManagementList } from "@/modules/inquiries/service";

export default async function AdminLeadsPage() {
  const tenant = await requireAdminSession();
  const [inquiries, staff] = await Promise.all([
    getInquiryManagementList(tenant),
    getAssignableStaffOptions(tenant),
  ]);

  return (
    <DashboardShell area="admin" title="Leads & Inquiries" subtitle="Lead source, owner assignment, and pipeline qualification view.">
      <InquiryManagement
        inquiries={inquiries}
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
