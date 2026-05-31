"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AdminNotificationListItem } from "@/modules/admin/queries";

export function NotificationManagement({
  notifications,
}: {
  notifications: AdminNotificationListItem[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  async function setReadState(notificationId: string, read: boolean) {
    setPendingId(notificationId);

    const response = await fetch(`/api/admin/notifications/${notificationId}/read`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read }),
    });

    setPendingId(null);

    if (!response.ok) {
      toast.error("Unable to update notification.");
      return;
    }

    toast.success(read ? "Notification marked as read." : "Notification marked as unread.");
    router.refresh();
  }

  async function markAllRead() {
    setIsMarkingAll(true);

    const response = await fetch("/api/admin/notifications/read-all", {
      method: "POST",
    });

    setIsMarkingAll(false);

    if (!response.ok) {
      toast.error("Unable to mark all notifications as read.");
      return;
    }

    toast.success("All notifications marked as read.");
    router.refresh();
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-6 py-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--ink-950)]">Recent notifications</h3>
          <p className="mt-1 text-sm text-[var(--ink-500)]">
            Review transactional delivery and clear unread operational noise.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={markAllRead}
          disabled={isMarkingAll || notifications.length === 0}
        >
          {isMarkingAll ? "Updating..." : "Mark all as read"}
        </Button>
      </div>
      <div className="divide-y divide-[var(--line)]">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className="grid gap-4 px-6 py-5 lg:grid-cols-[1.4fr_0.7fr_0.7fr_auto]"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {notification.state === "Unread" ? (
                  <span className="h-2 w-2 rounded-full bg-[var(--brand-700)]" aria-label="Unread" />
                ) : null}
                <div className="truncate text-base font-semibold text-[var(--ink-950)]">
                  {notification.title}
                </div>
              </div>
              <div className="mt-1 text-sm text-[var(--ink-500)]">
                {notification.channel}  -  {notification.recipient}
              </div>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--ink-600)]">{notification.body}</p>
              {notification.entityType && notification.entityId ? (
                <div className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--ink-400)]">
                  {notification.entityType} - {notification.entityId}
                </div>
              ) : null}
            </div>
            <div className="text-sm text-[var(--ink-700)]">{notification.created}</div>
            <div className="text-sm font-medium text-[var(--brand-700)]">
              {notification.state}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {notification.actionUrl ? (
                <Link
                  href={notification.actionUrl}
                  className="admin-interactive admin-focus inline-flex h-9 items-center justify-center rounded-full border border-[var(--line)] px-4 text-sm font-semibold text-[var(--ink-900)] hover:bg-[var(--sand-100)]"
                >
                  View
                </Link>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReadState(notification.id, notification.state !== "Read")}
                disabled={pendingId === notification.id}
              >
                {pendingId === notification.id
                  ? "Updating..."
                  : notification.state === "Read"
                    ? "Mark unread"
                    : "Mark read"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
