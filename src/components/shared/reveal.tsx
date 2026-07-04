"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

import { PREMIUM_EASE } from "@/components/shared/page-transition";

/**
 * Scroll-reveal wrapper for marketing/public surfaces. Fades + rises content
 * into view the first time it enters the viewport, then leaves it alone.
 *
 * Built on Framer Motion's `whileInView` (no new dependency, no scroll
 * hijacking). Honors `prefers-reduced-motion` by collapsing to a plain fade and
 * animates only transform/opacity, so there is no layout shift.
 *
 * Intended for marketing pages only — dashboards stay calm.
 */
export function Reveal({
  children,
  delay = 0,
  y = 16,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{
        duration: reduceMotion ? 0 : 0.5,
        ease: PREMIUM_EASE,
        delay: reduceMotion ? 0 : delay,
      }}
    >
      {children}
    </motion.div>
  );
}
