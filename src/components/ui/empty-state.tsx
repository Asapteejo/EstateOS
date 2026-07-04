import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Generic empty state for any surface (buyer portal, marketing, dashboards).
 * The admin surfaces have their own Card-based `AdminEmptyState`; this is the
 * unscoped equivalent for everywhere else, so empty lists read intentionally
 * rather than looking broken.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--line)] bg-white px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 text-[var(--ink-400)]" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <h3 className="text-lg font-semibold text-[var(--ink-950)]">{title}</h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--ink-500)]">{description}</p>
      ) : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-3">{action}</div> : null}
    </div>
  );
}
