import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full bg-[var(--sand-200)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-700)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
