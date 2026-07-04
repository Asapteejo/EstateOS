import type * as React from "react";

import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  interactive = false,
  style,
}: {
  className?: string;
  children: React.ReactNode;
  interactive?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        "tenant-card rounded-[24px] border border-[var(--border-subtle)] bg-[var(--tenant-card,#fff)] shadow-[var(--shadow-sm)]",
        interactive && "transition-[box-shadow,transform] duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:-translate-y-1 hover:border-[var(--brand-300)] hover:shadow-[var(--shadow-lg)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
      style={{
        borderRadius: "var(--tenant-card-radius, 24px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
