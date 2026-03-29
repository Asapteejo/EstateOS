"use client";

import { useRouter } from "next/navigation";
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

  async function markRead(notificationId: string) {
    setPendingId(notificationId);

    const response = await fetch(`/api/admin/notifications/${notificationId}/read`, {
      method: "PATCH",
    });

    setPendingId(null);

    if (!response.ok) {
      toast.error("Unable to mark notification as read.");
      return;
    }

    toast.success("Notification marked as read.");
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
            className="grid gap-4 px-6 py-5 lg:grid-cols-[1.4fr_0.8fr_1fr_auto]"
          >
            <div>
              <div className="text-base font-semibold text-[var(--ink-950)]">
                {notification.title}
              </div>
              <div className="mt-1 text-sm text-[var(--ink-500)]">
                {notification.channel} · {notification.recipient}
              </div>
            </div>
            <div className="text-sm text-[var(--ink-700)]">{notification.created}</div>
            <div className="text-sm font-medium text-[var(--brand-700)]">
              {notification.state}
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => markRead(notification.id)}
                disabled={pendingId === notification.id || notification.state === "Read"}
              >
                {pendingId === notification.id ? "Updating..." : "Mark read"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
