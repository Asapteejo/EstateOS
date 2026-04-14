"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

const DEV_ACCESS_STORAGE_KEY = "estateos-dev-access-open";

type DevAccessPanelProps = {
  activeRole: string;
  tenantSiteHref: string | null;
  presets: ReadonlyArray<{
    label: string;
    role: string;
    href: string;
  }>;
};

export function DevAccessPanel({
  activeRole,
  tenantSiteHref,
  presets,
}: DevAccessPanelProps) {
  const isOpen = useSyncExternalStore(
    (callback) => {
      const handle = () => callback();
      window.addEventListener("storage", handle);
      window.addEventListener(DEV_ACCESS_STORAGE_KEY, handle);
      return () => {
        window.removeEventListener("storage", handle);
        window.removeEventListener(DEV_ACCESS_STORAGE_KEY, handle);
      };
    },
    () => window.localStorage.getItem(DEV_ACCESS_STORAGE_KEY) === "open",
    () => false,
  );

  function updateOpen(next: boolean) {
    window.localStorage.setItem(DEV_ACCESS_STORAGE_KEY, next ? "open" : "closed");
    window.dispatchEvent(new Event(DEV_ACCESS_STORAGE_KEY));
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => updateOpen(true)}
        className="fixed bottom-4 left-4 z-[60] rounded-full border border-[var(--line)] bg-white/92 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-700)] shadow-lg backdrop-blur transition hover:border-[var(--brand-500)] hover:text-[var(--ink-950)]"
      >
        Dev
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-[60] w-[min(320px,calc(100vw-2rem))] rounded-3xl border border-[var(--line)] bg-white/96 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-500)]">
            Dev access
          </div>
          <div className="mt-2 text-sm text-[var(--ink-600)]">
            Current demo role: <span className="font-semibold text-[var(--ink-950)]">{activeRole}</span>
          </div>
          <div className="mt-1 text-xs text-[var(--ink-500)]">
            Tenant site: <span className="font-medium text-[var(--ink-700)]">{tenantSiteHref ?? "No tenant workspace yet"}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => updateOpen(false)}
          className="rounded-full border border-[var(--line)] px-2.5 py-1 text-xs font-medium text-[var(--ink-600)] transition hover:border-[var(--brand-500)] hover:text-[var(--ink-950)]"
          aria-label="Collapse dev access panel"
        >
          Close
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {presets.map((preset) => (
          <Link
            key={preset.label}
            href={`/api/dev/session?role=${preset.role}&redirectTo=${encodeURIComponent(preset.href)}`}
            className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-700)] transition hover:border-[var(--brand-500)] hover:text-[var(--ink-950)]"
          >
            {preset.label}
          </Link>
        ))}
        {tenantSiteHref ? (
          <Link
            href={`/api/dev/session?role=clear&redirectTo=${encodeURIComponent(tenantSiteHref)}`}
            className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-700)] transition hover:border-[var(--brand-500)] hover:text-[var(--ink-950)]"
          >
            Tenant Site
          </Link>
        ) : (
          <span className="rounded-full border border-dashed border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-400)]">
            Tenant Site unavailable
          </span>
        )}
      </div>
    </div>
  );
}
