"use client";

import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * Animated success confirmation: a spring-in badge with a checkmark that draws
 * itself. Use for completed actions where a brief, satisfying confirmation adds
 * polish beyond a toast (e.g. a submitted form).
 *
 * Under `prefers-reduced-motion` it renders the final state instantly (no
 * spring, no draw). Announced to screen readers via the wrapper's aria-label.
 */
export function SuccessCheck({
  className,
  size = 56,
  label = "Success",
}: {
  className?: string;
  size?: number;
  label?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <span role="img" aria-label={label} className={cn("inline-flex", className)}>
      <svg width={size} height={size} viewBox="0 0 52 52" fill="none" aria-hidden="true">
        <motion.circle
          cx="26"
          cy="26"
          r="24"
          fill="var(--brand-100)"
          stroke="var(--brand-700)"
          strokeWidth="2.5"
          style={{ transformOrigin: "center" }}
          initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
        />
        <motion.path
          d="M15.5 27.5l6.5 6.5 14.5-15"
          fill="none"
          stroke="var(--brand-700)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduceMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: reduceMotion ? 0 : 0.18 }}
        />
      </svg>
    </span>
  );
}
