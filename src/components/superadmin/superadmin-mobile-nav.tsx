"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/shared/theme-toggle";
import { cn } from "@/lib/utils";

type SuperadminNavItem = readonly [string, string];

/**
 * Mobile/tablet (below `lg`) navigation for the superadmin (platform owner)
 * shell. Replaces the old behaviour where the full sidebar stacked on top of
 * the content on small screens and pushed the page down. The desktop sidebar in
 * SuperadminShell is unchanged (now `hidden lg:block`).
 *
 * Accessibility mirrors the other drawers (DashboardMobileNav / MarketingMobileNav):
 * body-scroll lock, Escape to close, Tab focus-trap, focus moved into the panel
 * and restored to the trigger on close, and close on route change.
 */
export function SuperadminMobileNav({
  links,
}: {
  links: ReadonlyArray<SuperadminNavItem>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const drawerId = useId();

  const isActive = (href: string) =>
    pathname === href || (href !== "/superadmin" && Boolean(pathname?.startsWith(`${href}/`)));

  // While open: lock body scroll, Escape to close, trap Tab focus, focus panel.
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
    <div className="lg:hidden">
      <div className="sticky top-0 z-40 flex items-center justify-between gap-3 rounded-[24px] border border-[var(--line)] bg-white px-4 py-3 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
        <Link href="/superadmin" className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--ink-500)]">
            Platform owner
          </div>
          <div className="font-serif text-xl text-[var(--ink-950)]">EstateOS</div>
        </Link>
        <ThemeToggle className="shrink-0" />
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={drawerId}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--line)] bg-white text-[var(--ink-700)]"
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
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50">
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
            aria-label="EstateOS platform navigation"
            className="motion-drawer-left absolute inset-y-0 left-0 flex w-[86vw] max-w-xs flex-col gap-4 overflow-y-auto border-r border-[var(--line)] bg-white p-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-[20px] bg-[linear-gradient(140deg,#052e2b,#0d5f4a_55%,#d7b98f)] px-4 py-3 text-white">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/70">
                  Platform owner
                </div>
                <div className="font-serif text-xl">EstateOS</div>
              </div>
              <button
                type="button"
                onClick={closeAndRestoreFocus}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--line)] bg-white text-[var(--ink-700)]"
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

            <nav className="flex flex-col gap-1" aria-label="Platform navigation">
              {links.map(([label, href]) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-2xl px-4 py-3 text-sm font-semibold text-[var(--ink-700)] transition hover:bg-[var(--sand-100)]",
                      active && "bg-[var(--ink-950)] text-white hover:bg-[var(--ink-950)]",
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      ) : null}
    </div>
  );
}
