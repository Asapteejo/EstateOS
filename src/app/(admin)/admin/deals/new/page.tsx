import { DealCreateForm } from "@/components/admin/deal-create-form";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requireAdminSession } from "@/lib/auth/guards";
import { getAdminDealCreationOptions } from "@/modules/admin/deals";

export default async function AdminDealCreatePage() {
  const tenant = await requireAdminSession(["ADMIN"]);
  const options = await getAdminDealCreationOptions(tenant);

  return (
    <DashboardShell
      area="admin"
      title="Create First Deal"
      subtitle="Open a buyer deal in under a minute so the Deal Board can start tracking revenue, payments, and collections."
    >
      <DealCreateForm options={options} />
    </DashboardShell>
  );
}
