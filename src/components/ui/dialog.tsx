"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

/**
 * Accessible modal dialog primitive — the shared replacement for the bespoke
 * per-screen modals. Behavior mirrors the dashboard drawer (the app's most
 * battle-tested overlay): body scroll lock, Escape to close, Tab focus trap,
 * focus moves into the panel on open and back to the previously focused
 * element on close. Rendered via a portal to document.body so an ancestor
 * `transform` (e.g. the animated header) can never break the fixed overlay.
 * Styling uses the design tokens, so tenant theming and the dark scope apply
 * automatically.
 *
 * Controlled component:
 *   <Dialog open={open} onClose={() => setOpen(false)} title="Invite member">
 *     …form…
 *   </Dialog>
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  className,
}: {
  open: boolean;
  onClose: () => void;
  /** Required for accessibility — rendered as the dialog heading. */
  title: string;
  /** Optional supporting copy under the title. */
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href]',
    );
    firstFocusable?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        className="motion-overlay absolute inset-0 bg-[rgba(15,23,42,0.45)]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          "motion-panel relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[var(--radius-xl)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-xl)] sm:rounded-[var(--radius-xl)]",
          size === "sm" && "sm:max-w-md",
          size === "md" && "sm:max-w-lg",
          size === "lg" && "sm:max-w-2xl",
          size === "xl" && "sm:max-w-5xl",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-6 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold tracking-[-0.01em] text-[var(--ink-950)]">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm leading-5 text-[var(--ink-500)]">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="admin-interactive admin-focus -mr-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--ink-500)] hover:bg-[var(--sand-100)] hover:text-[var(--ink-900)]"
          >
            <span className="sr-only">Close dialog</span>
            <svg
              width="18"
              height="18"
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
        <div className="min-h-0 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** Standard footer row for dialog actions — right-aligned, gap-consistent. */
export function DialogFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mt-5 flex flex-wrap items-center justify-end gap-3", className)}>
      {children}
    </div>
  );
}
