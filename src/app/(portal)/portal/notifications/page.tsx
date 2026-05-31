import Link from "next/link";

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
        {notifications.length > 0 ? notifications.map((notification) => (
          <Card key={notification.id} className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {notification.state === "Unread" ? (
                    <span className="h-2 w-2 rounded-full bg-[var(--brand-700)]" aria-label="Unread" />
                  ) : null}
                  <h3 className="truncate text-lg font-semibold text-[var(--ink-950)]">{notification.title}</h3>
                </div>
              </div>
              <span className="text-sm text-[var(--ink-500)]">{notification.time}</span>
            </div>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-600)]">{notification.body}</p>
            {notification.actionUrl ? (
              <Link
                href={notification.actionUrl}
                className="admin-interactive admin-focus mt-4 inline-flex h-9 items-center justify-center rounded-full border border-[var(--line)] px-4 text-sm font-semibold text-[var(--ink-900)] hover:bg-[var(--sand-100)]"
              >
                View update
              </Link>
            ) : null}
          </Card>
        )) : (
          <Card className="p-8 text-center">
            <h3 className="text-lg font-semibold text-[var(--ink-950)]">No notifications yet</h3>
            <p className="mt-2 text-sm text-[var(--ink-500)]">
              Replies, document updates, and payment notices from your sales team will appear here.
            </p>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
