import { NotificationManagement } from "@/components/admin/notification-management";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requireAdminSession } from "@/lib/auth/guards";
import { getAdminNotificationsList } from "@/modules/admin/queries";

export default async function AdminNotificationsPage() {
  const tenant = await requireAdminSession();
  const notifications = await getAdminNotificationsList(tenant);

  return (
    <DashboardShell area="admin" title="Notifications" subtitle="Campaigns, transactional templates, and operator-triggered notifications scaffold.">
      <NotificationManagement notifications={notifications} />
    </DashboardShell>
  );
}
