"use client";

import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";

import type { AnnouncementNotice } from "@/modules/announcements/service";

const STORAGE_KEY = "estateos_dismissed_announcements";

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Dismissible broadcast banner shown at the top of the dashboard (buyer portal
 * or operator workspace). Dismissal is persisted in localStorage so a notice a
 * user has closed stays closed across navigation and reloads — until the
 * operator unpublishes it or it expires (both drop it server-side).
 */
export function AnnouncementBanner({ items }: { items: AnnouncementNotice[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    const id = setTimeout(() => setDismissed(readDismissed()), 0);
    return () => clearTimeout(id);
  }, []);

  function dismiss(id: string) {
    setDismissed((prev) => {
      const next = Array.from(new Set([...prev, id])).slice(-100);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage may be unavailable; dismissal still holds for this session */
      }
      return next;
    });
  }

  const visible = items.filter((item) => !dismissed.includes(item.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-3">
      {visible.map((item) => (
        <div
          key={item.id}
          role="status"
          className="flex items-start gap-3 rounded-[var(--radius-xl)] border border-[var(--brand-300)] bg-[var(--brand-50)] p-4 shadow-[var(--shadow-sm)]"
        >
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--surface-1,#fff)] text-[var(--brand-ink)]" aria-hidden>
            <Megaphone className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-[var(--ink-950)]">{item.title}</div>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--ink-700)]">{item.body}</p>
            <div className="mt-1 text-xs text-[var(--ink-500)]">{item.when}</div>
          </div>
          <button
            type="button"
            aria-label="Dismiss announcement"
            onClick={() => dismiss(item.id)}
            className="admin-focus grid h-7 w-7 shrink-0 place-items-center rounded-full text-[var(--ink-500)] transition-colors hover:bg-[var(--surface-1,#fff)] hover:text-[var(--ink-900)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
