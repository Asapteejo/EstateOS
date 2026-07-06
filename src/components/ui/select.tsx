import { cn } from "@/lib/utils";

/**
 * Styled native select — the shared replacement for the ~34 bespoke `<select>`
 * elements across the app. Deliberately built on the NATIVE element: it is the
 * most accessible, mobile-friendly picker there is (iOS/Android render their
 * platform pickers), needs no JS, and works inside plain server-rendered
 * forms. The wrapper only normalizes visuals: height, radius, border, focus
 * ring, and a consistent chevron (the native arrow is suppressed).
 *
 * Match with <Input /> for height (h-11) so mixed form rows line up.
 */
export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={cn("relative inline-flex", className)}>
      <select
        className="admin-interactive admin-focus h-11 w-full cursor-pointer appearance-none rounded-[var(--radius-md)] border border-[var(--line)] bg-white pl-4 pr-10 text-sm text-[var(--ink-900)] focus:border-[var(--brand-500)] disabled:cursor-not-allowed disabled:bg-[var(--sand-50)] disabled:text-[var(--ink-500)]"
        {...props}
      >
        {children}
      </select>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-500)]"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </span>
  );
}
