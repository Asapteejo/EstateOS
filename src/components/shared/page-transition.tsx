"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Wraps page content in a subtle, GPU-friendly enter transition.
 *
 * Designed to live inside `app/template.tsx`, which Next.js re-mounts on every
 * navigation — so the enter animation replays on each route change without any
 * pathname bookkeeping for the animation itself.
 *
 * Dashboard surfaces (portal / admin / superadmin) are intentionally skipped:
 * their shells already animate the content area on their own (CSS
 * `tenant-page-enter` / `tenant-content-reveal`) and keep a persistent sidebar.
 * Wrapping them here would double-animate and fade the sidebar with the content.
 *
 * Honors `prefers-reduced-motion`: the rise is dropped and only a brief opacity
 * fade remains. Animation is limited to `opacity`/`transform` to avoid layout
 * thrash and CLS.
 */
const SELF_ANIMATED_PREFIXES = ["/portal", "/admin", "/superadmin"];

// Shared premium easing (easeOutExpo-style): a quick start that settles softly.
// Exported so other motion surfaces (drawers, dropdowns) can stay consistent.
// Typed as a mutable cubic-bezier tuple so framer-motion accepts it directly.
export const PREMIUM_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function PageTransition({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const pathname = usePathname();

  const isSelfAnimated = SELF_ANIMATED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname?.startsWith(`${prefix}/`),
  );

  if (isSelfAnimated) {
    return <>{children}</>;
  }

  // Reduced motion: a quiet cross-fade only, no positional travel.
  if (reduceMotion) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: "linear" }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.34,
        ease: PREMIUM_EASE,
        opacity: { duration: 0.26, ease: "easeOut" },
      }}
    >
      {children}
    </motion.div>
  );
}
