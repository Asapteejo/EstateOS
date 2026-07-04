import { cn } from "@/lib/utils";

/**
 * Determinate (or indeterminate) progress bar for operations whose duration is
 * observable — file uploads being the primary case.
 *
 * Pass `value` (0–100) for a real progress fill; omit it for an indeterminate
 * sweep when total work is unknown. Always provide a `label` for assistive tech.
 * The fill animates its width with a short CSS transition, so callers only need
 * to push new `value`s as progress events arrive.
 */
export function ProgressBar({
  value,
  className,
  label,
}: {
  value?: number;
  className?: string;
  label: string;
}) {
  const determinate = typeof value === "number";
  const clamped = determinate ? Math.min(100, Math.max(0, value)) : undefined;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={determinate ? clamped : undefined}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-[var(--sand-100)]", className)}
    >
      {determinate ? (
        <div
          className="h-full rounded-full bg-[var(--brand-700)] transition-[width] duration-300 ease-[var(--ease-out)]"
          style={{ width: `${clamped}%` }}
        />
      ) : (
        <div className="progress-indeterminate h-full w-1/4 rounded-full bg-[var(--brand-700)]" />
      )}
    </div>
  );
}
