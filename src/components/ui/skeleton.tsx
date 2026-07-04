import { cn } from "@/lib/utils";

/**
 * Generic skeleton placeholder for content that is loading. Shares the shimmer
 * treatment used by the admin surfaces (`.skeleton` aliases `.admin-skeleton`
 * in globals.css) so loading states look consistent across every surface.
 *
 * Compose several to build a skeleton screen for a whole page/section. The
 * shimmer is decorative, so it is correctly stilled under reduced-motion while
 * the placeholder block remains visible.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4 w-full", className)} aria-hidden="true" />;
}
