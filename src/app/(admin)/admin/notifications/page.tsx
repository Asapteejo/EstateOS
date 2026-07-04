import { NotificationManagement } from "@/components/admin/notification-management";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requireAdminSession } from "@/lib/auth/guards";
import { rolesForAdminPath } from "@/lib/auth/admin-sections";
import { getAdminNotificationsList } from "@/modules/admin/queries";

export default async function AdminNotificationsPage() {
  const tenant = await requireAdminSession(rolesForAdminPath("/admin/notifications"));
  const notifications = await getAdminNotificationsList(tenant);

  return (
    <DashboardShell area="admin" title="Notifications" subtitle="Campaigns, transactional templates, and operator-triggered notifications scaffold.">
      <NotificationManagement notifications={notifications} />
    </DashboardShell>
  );
}
