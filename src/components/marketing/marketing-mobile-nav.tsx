"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";

type MarketingNavLink = { href: string; label: string };

/**
 * Mobile/tablet (below `lg`) navigation for the tenant public site header.
 *
 * Implemented as an absolute-positioned dropdown anchored to the trigger —
 * matching the platform marketing header's mobile menu — rather than a fixed
 * full-screen drawer. This is deliberate: `MarketingHeader` uses
 * `backdrop-blur-xl`, and an ancestor with `backdrop-filter` becomes the
 * containing block for `position: fixed` descendants, which would clip a fixed
 * drawer to the header bounds. An absolute dropdown anchors to this component's
 * own `relative` wrapper and renders correctly.
 *
 * Closes on link tap, Escape, and outside click.
 */
export function MarketingMobileNav({
  links,
  buyerPortalHref,
}: {
  links: ReadonlyArray<MarketingNavLink>;
  buyerPortalHref: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Close on Escape or a click/tap outside the menu.
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        className="admin-focus inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--tenant-nav-border,var(--line))] bg-[var(--tenant-nav-surface)] text-[var(--ink-900)] transition hover:bg-[var(--sand-100)]"
      >
        <span className="sr-only">{open ? "Close navigation menu" : "Open navigation menu"}</span>
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
          {open ? (
            <>
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </>
          ) : (
            <>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>

      {open ? (
        <div
          id={menuId}
          className="motion-dropdown absolute right-0 top-14 z-50 w-64 rounded-2xl border border-[var(--tenant-nav-border,var(--line))] bg-white p-2 shadow-[var(--shadow-md)]"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--ink-700)] transition hover:bg-[var(--sand-100)] hover:text-[var(--ink-950)]"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={buyerPortalHref}
            onClick={() => setOpen(false)}
            className="block whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--ink-700)] transition hover:bg-[var(--sand-100)] hover:text-[var(--ink-950)]"
          >
            Buyer Portal
          </Link>
        </div>
      ) : null}
    </div>
  );
}
