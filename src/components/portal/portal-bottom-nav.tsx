"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CreditCard, Heart, House, MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Buyer-portal bottom tab bar — mobile/tablet only (hidden at `lg`, where the
 * sidebar takes over). Puts the five destinations buyers actually live in
 * within thumb reach instead of behind the drawer; the drawer stays available
 * from the top bar for the long tail. Respects the iOS/Android home-indicator
 * safe area (matters for the installed PWA), carries unread badges for
 * Messages/Alerts, and uses tenant tokens so dark mode applies.
 */
const TABS = [
  { label: "Home", href: "/portal", icon: House },
  { label: "Saved", href: "/portal/saved", icon: Heart },
  { label: "Messages", href: "/portal/messages", icon: MessageCircle },
  { label: "Payments", href: "/portal/payments", icon: CreditCard },
  { label: "Alerts", href: "/portal/notifications", icon: Bell },
] as const;

export function PortalBottomNav({
  unreadNotificationCount = 0,
  messagesUnreadCount = 0,
}: {
  unreadNotificationCount?: number;
  messagesUnreadCount?: number;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || (href !== "/portal" && Boolean(pathname?.startsWith(`${href}/`)));

  const badgeFor = (label: (typeof TABS)[number]["label"]) =>
    label === "Messages" ? messagesUnreadCount : label === "Alerts" ? unreadNotificationCount : 0;

  return (
    <nav
      aria-label="Buyer quick navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--tenant-nav-border,var(--line))] bg-[var(--tenant-nav-surface,var(--surface))]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--tenant-nav-surface,var(--surface))]/85 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-between px-2">
        {TABS.map(({ label, href, icon: Icon }) => {
          const active = isActive(href);
          const badge = badgeFor(label);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "admin-focus relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[var(--radius-sm)] px-1 pb-2 pt-2.5 text-[11px] font-medium",
                active
                  ? "text-[var(--brand-ink)]"
                  : "text-[var(--ink-500)] hover:text-[var(--ink-800)]",
              )}
            >
              <span className="relative">
                <Icon
                  className="h-5 w-5"
                  strokeWidth={active ? 2.4 : 2}
                  aria-hidden="true"
                />
                {badge > 0 ? (
                  <span
                    className="absolute -right-2 -top-1.5 min-w-4 rounded-full bg-[var(--brand-700)] px-1 py-px text-center text-[10px] font-semibold leading-3.5 text-white"
                    aria-label={`${badge} unread`}
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </span>
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
