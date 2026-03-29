import { DashboardShell } from "@/components/portal/dashboard-shell";
import { Card } from "@/components/ui/card";
import { requirePortalSession } from "@/lib/auth/guards";
import { getBuyerNotifications } from "@/modules/portal/queries";

export default async function PortalNotificationsPage() {
  const tenant = await requirePortalSession();
  const notifications = await getBuyerNotifications(tenant);

  return (
    <DashboardShell area="portal" title="Notifications" subtitle="Email and in-app notification history for client updates.">
      <div className="space-y-4">
        {notifications.map((notification) => (
          <Card key={notification.title} className="p-6">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-[var(--ink-950)]">{notification.title}</h3>
              <span className="text-sm text-[var(--ink-500)]">{notification.time}</span>
            </div>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-600)]">{notification.body}</p>
          </Card>
        ))}
      </div>
    </DashboardShell>
  );
}
