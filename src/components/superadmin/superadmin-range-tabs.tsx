import Link from "next/link";

import { cn } from "@/lib/utils";
import type { SuperadminRange } from "@/modules/superadmin/queries";

const RANGE_OPTIONS: Array<{ value: SuperadminRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "all", label: "All time" },
];

export function SuperadminRangeTabs({
  pathname,
  current,
  extraParams,
}: {
  pathname: string;
  current: SuperadminRange;
  extraParams?: Record<string, string | null | undefined>;
}) {
  return (
    <div className="inline-flex rounded-full border border-[var(--line)] bg-white p-1 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
      {RANGE_OPTIONS.map((option) => {
        const params = new URLSearchParams();
        params.set("range", option.value);

        for (const [key, value] of Object.entries(extraParams ?? {})) {
          if (value) {
            params.set(key, value);
          }
        }

        return (
          <Link
            key={option.value}
            href={`${pathname}?${params.toString()}`}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold text-[var(--ink-600)] transition",
              current === option.value && "bg-[var(--ink-950)] text-white",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
