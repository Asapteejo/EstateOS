"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Lightweight, accessible modal used by the quick-create actions. Rendered via a
 * portal to document.body so an ancestor `transform` (from the animated header)
 * can never break the fixed full-screen overlay. Closes on Escape or backdrop
 * click, locks body scroll, and moves focus into the panel on open.
 */
export function QuickCreateModal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full max-w-md rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--surface-1,#fff)] p-6 shadow-2xl outline-none"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--ink-950)]">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-sm text-[var(--ink-500)]">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="admin-focus -mr-1 shrink-0 rounded-full p-1.5 text-[var(--ink-500)] transition-colors hover:bg-[var(--sand-100,#f1f5f9)] hover:text-[var(--ink-800)]"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
