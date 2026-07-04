"use client";

import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { useRef } from "react";
import type { PointerEvent, ReactNode } from "react";

/**
 * Magnetic hover wrapper: the child drifts slightly toward the cursor and
 * springs back on leave. Purely decorative enhancement.
 *
 * Safety rails (per the hover-vs-tap accessibility rule):
 *  - Only reacts to a real mouse (`pointerType === "mouse"`); touch/pen do
 *    nothing, so the wrapped control behaves normally on phones/tablets.
 *  - Disabled entirely under `prefers-reduced-motion`.
 *  - Translates with transform only (no layout shift); the child stays fully
 *    clickable since the offset is small and pointer events pass through.
 */
export function Magnetic({
  children,
  strength = 0.3,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 200, damping: 15, mass: 0.5 });
  const springY = useSpring(y, { stiffness: 200, damping: 15, mass: 0.5 });

  function handlePointerMove(event: PointerEvent<HTMLSpanElement>) {
    if (reduceMotion || event.pointerType !== "mouse") {
      return;
    }
    const element = ref.current;
    if (!element) {
      return;
    }
    const rect = element.getBoundingClientRect();
    const offsetX = event.clientX - (rect.left + rect.width / 2);
    const offsetY = event.clientY - (rect.top + rect.height / 2);
    x.set(offsetX * strength);
    y.set(offsetY * strength);
  }

  function reset() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.span
      ref={ref}
      className={className}
      style={{ x: springX, y: springY, display: "inline-flex" }}
      onPointerMove={handlePointerMove}
      onPointerLeave={reset}
    >
      {children}
    </motion.span>
  );
}
