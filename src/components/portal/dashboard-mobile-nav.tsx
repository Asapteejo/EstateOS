"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type NavLink = readonly [string, string];

/**
 * Mobile/tablet (below `lg`) navigation for the dashboard shell.
 *
 * Replaces the stacked tile grid of nav links — which previously pushed the
 * actual page content far down the screen on small viewports — with a sticky
 * top bar (company identity + menu button) plus a slide-in drawer that holds
 * the full navigation. Rendered only below `lg`; the desktop sidebar in
 * DashboardShell is unchanged. This is a client component because the drawer
 * needs interactivity (open/close, Escape, focus management, body scroll lock).
 */
export function DashboardMobileNav({
  area,
  links,
  companyName,
  logoUrl,
  unreadNotificationCount,
  portalUser,
}: {
  area: "portal" | "admin";
  links: ReadonlyArray<NavLink>;
  companyName: string;
  logoUrl?: string | null;
  unreadNotificationCount: number;
  portalUser?: { name: string; imageUrl?: string | null } | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const drawerId = useId();

  const workspaceTagline = area === "portal" ? "Buyer workspace" : "Company workspace";
  const surfaceLabel = area === "portal" ? "Buyer surface" : "Operator surface";

  const isActive = (href: string) =>
    pathname === href || (href !== `/${area}` && Boolean(pathname?.startsWith(`${href}/`)));

  // While the drawer is open: lock body scroll, close on Escape, trap Tab focus,
  // and move focus into the panel. Everything is restored on close/unmount.
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        menuButtonRef.current?.focus();
        return;
      }

      if (event.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) {
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
      'a[href], button:not([disabled])',
    );
    firstFocusable?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const closeAndRestoreFocus = () => {
    setOpen(false);
    menuButtonRef.current?.focus();
  };

  return (
    <>
      {/* Sticky top bar — this element is itself the grid item, so `sticky`
          pins it against the tall grid container as the page scrolls. Identity
          on the left, menu trigger on the right. Hidden on desktop (`lg`). */}
      <div className="sticky top-0 z-40 -mx-5 flex items-center justify-between gap-3 border-b border-[var(--tenant-nav-border)] bg-[var(--tenant-nav-surface)]/95 px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-[var(--tenant-nav-surface)]/80 sm:-mx-8 sm:px-8 lg:hidden">
        <div className="min-w-0 flex-1">
          <Logo href={`/${area}`} name={companyName} tagline={workspaceTagline} logoUrl={logoUrl} />
        </div>
        <ThemeToggle className="shrink-0" />
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={drawerId}
          className="admin-interactive admin-focus relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--tenant-nav-border)] bg-white/60 text-[var(--ink-700)]"
        >
          <span className="sr-only">Open navigation menu</span>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          {unreadNotificationCount > 0 ? (
            <span
              className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[var(--brand-700)] px-1.5 py-0.5 text-center text-[11px] font-semibold leading-4 text-white"
              aria-label={`${unreadNotificationCount} unread notifications`}
            >
              {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
            </span>
          ) : null}
        </button>
      </div>

      {/* Slide-in drawer + backdrop. */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="motion-overlay absolute inset-0 bg-[rgba(15,23,42,0.45)]"
            onClick={closeAndRestoreFocus}
            aria-hidden="true"
          />
          <div
            ref={panelRef}
            id={drawerId}
            role="dialog"
            aria-modal="true"
            aria-label={`${companyName} navigation`}
            className="motion-drawer-left absolute inset-y-0 left-0 flex w-[86vw] max-w-xs flex-col gap-4 overflow-y-auto border-r border-[var(--tenant-nav-border)] bg-[var(--tenant-nav-surface)] p-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Logo href={`/${area}`} name={companyName} tagline={workspaceTagline} logoUrl={logoUrl} />
              </div>
              <button
                type="button"
                onClick={closeAndRestoreFocus}
                className="admin-interactive admin-focus inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--tenant-nav-border)] bg-white/60 text-[var(--ink-700)]"
              >
                <span className="sr-only">Close navigation menu</span>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>

            {portalUser ? (
              <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--tenant-nav-border)]/60 bg-white/60 px-3 py-3">
                <Avatar name={portalUser.name} imageUrl={portalUser.imageUrl} size="md" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[var(--ink-900)]">{portalUser.name}</div>
                  <div className="text-xs text-[var(--ink-500)]">Buyer profile</div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <span className="admin-chip border-[var(--tenant-nav-border)] bg-white/60 text-[var(--ink-600)]">
                {surfaceLabel}
              </span>
              <span className="admin-chip border-[var(--tenant-nav-border)] bg-white/60 text-[var(--ink-600)]">
                {links.length} views
              </span>
            </div>

            <nav className="flex flex-col gap-1" aria-label={`${surfaceLabel} navigation`}>
              {links.map(([label, href]) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "tenant-nav-link admin-interactive admin-focus flex items-center justify-between gap-2 rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium text-[var(--ink-700)] hover:bg-[var(--sand-100)] hover:text-[var(--ink-950)]",
                      active && "tenant-nav-link-active bg-[var(--sand-100)] text-[var(--ink-950)] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]",
                    )}
                  >
                    <span className="truncate">{label}</span>
                    {label === "Notifications" && unreadNotificationCount > 0 ? (
                      <span className="min-w-5 rounded-full bg-[var(--brand-700)] px-1.5 py-0.5 text-center text-[11px] font-semibold leading-4 text-white">
                        {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
