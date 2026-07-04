import { cn } from "@/lib/utils";

/**
 * Inline loading spinner for small, contained actions (a button mid-submit, a
 * section that is refreshing). Sizes to the surrounding font via `currentColor`
 * and `em`-free pixel sizing.
 *
 * Pass a `label` to announce the loading state to screen readers (renders as a
 * `role="status"` live region). Omit it when the spinner sits inside an element
 * that already conveys busy state (e.g. a Button with `aria-busy`), so it stays
 * purely decorative and is not double-announced.
 *
 * Stays spinning under `prefers-reduced-motion` — a loading spinner is
 * functional feedback, not decorative motion (see `.spinner` in globals.css).
 */
export function Spinner({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span role={label ? "status" : undefined} className={cn("inline-flex", className)}>
      <svg
        className="spinner h-4 w-4 text-current"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3.5" />
        <path
          className="opacity-90"
          d="M12 2a10 10 0 0 1 10 10"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
