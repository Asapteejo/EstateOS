"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type SidebarNavGroup = {
  label: string;
  items: ReadonlyArray<readonly [string, string]>;
};

/**
 * Grouped, collapsible workspace navigation. Replaces the previous flat list
 * of up to ~30 links with labeled clusters (Workspace / Sales / Finance / …)
 * so operators scan a handful of headings instead of a wall of links.
 *
 * - Active route detection via usePathname (exact for the area root, prefix
 *   match for everything else) with `aria-current="page"`.
 * - Collapse state persists per surface in localStorage; everything starts
 *   expanded (and renders expanded on the server) so there is no hydration
 *   mismatch and no content is hidden from first-time users.
 * - Unread badges stay attached to the Notifications / Messages items.
 *
 * Used by BOTH the desktop sidebar (rendered from the server shell) and the
 * mobile drawer (which passes `onNavigate` to close itself on link click).
 */
export function SidebarNavGroups({
  area,
  groups,
  unreadNotificationCount = 0,
  messagesUnreadCount = 0,
  onNavigate,
}: {
  area: "portal" | "admin";
  groups: SidebarNavGroup[];
  unreadNotificationCount?: number;
  messagesUnreadCount?: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const storageKey = `estateos-nav-collapsed:${area}`;
  const [collapsed, setCollapsed] = useState<ReadonlyArray<string>>([]);

  // Load persisted collapse state after mount (SSR always renders expanded).
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === "string")) {
            setCollapsed(parsed);
          }
        }
      } catch {
        // Storage unavailable (private mode etc.) — stay expanded.
      }
    }, 0);
    return () => clearTimeout(id);
  }, [storageKey]);

  const toggleGroup = (label: string) => {
    setCollapsed((current) => {
      const next = current.includes(label)
        ? current.filter((entry) => entry !== label)
        : [...current, label];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Persistence is best-effort.
      }
      return next;
    });
  };

  const isActive = (href: string) =>
    pathname === href || (href !== `/${area}` && Boolean(pathname?.startsWith(`${href}/`)));

  const renderLink = ([label, href]: readonly [string, string]) => {
    const active = isActive(href);
    const badgeCount =
      label === "Notifications"
        ? unreadNotificationCount
        : label === "Messages"
          ? messagesUnreadCount
          : 0;
    return (
      <Link
        key={href}
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "tenant-nav-link admin-interactive admin-focus flex items-center justify-between gap-2 rounded-[var(--radius-md)] px-4 py-2.5 text-sm font-medium text-[var(--ink-700)] hover:bg-[var(--sand-100)] hover:text-[var(--ink-950)]",
          active &&
            "tenant-nav-link-active bg-[var(--sand-100)] text-[var(--ink-950)] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]",
        )}
      >
        <span className="truncate">{label}</span>
        {badgeCount > 0 ? (
          <span className="min-w-5 rounded-full bg-[var(--brand-700)] px-1.5 py-0.5 text-center text-[11px] font-semibold leading-4 text-white">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        ) : null}
      </Link>
    );
  };

  // A single group renders as a plain list — no header, nothing to collapse.
  if (groups.length <= 1) {
    return (
      <nav className="flex min-w-0 flex-col gap-1" aria-label="Workspace navigation">
        {groups.flatMap((group) => group.items.map(renderLink))}
      </nav>
    );
  }

  return (
    <nav className="flex min-w-0 flex-col gap-1" aria-label="Workspace navigation">
      {groups.map((group) => {
        const isCollapsed = collapsed.includes(group.label);
        const groupHasActive = group.items.some(([, href]) => isActive(href));
        return (
          <section key={group.label} className="min-w-0">
            <button
              type="button"
              onClick={() => toggleGroup(group.label)}
              aria-expanded={!isCollapsed}
              className={cn(
                "admin-interactive admin-focus mt-3 flex w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-400)] first:mt-0 hover:text-[var(--ink-700)]",
                groupHasActive && isCollapsed && "text-[var(--brand-ink)]",
              )}
            >
              <span className="truncate">{group.label}</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={cn("shrink-0 transition-transform duration-150", isCollapsed && "-rotate-90")}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {isCollapsed ? null : (
              <div className="mt-1 flex min-w-0 flex-col gap-1">{group.items.map(renderLink)}</div>
            )}
          </section>
        );
      })}
    </nav>
  );
}
