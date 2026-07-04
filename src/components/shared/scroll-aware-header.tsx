"use client";

import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "framer-motion";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const REVEAL_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Scroll-aware marketing header.
 *
 * - Hides (slides up) when the visitor scrolls down past `hideThreshold`.
 * - Slides back in the moment they scroll up.
 * - Detaches into a floating, rounded "glass pill" once the page is scrolled.
 *
 * The visual chrome (background, blur, borders) is supplied by the caller via
 * `className` / `topClassName` / `floatingClassName` so the same behavior serves
 * both the tenant site and the EstateOS marketing site without theme leakage.
 *
 * Fully additive and non-breaking: at scroll position 0 the header renders flush
 * and full-width exactly as before. Respects `prefers-reduced-motion` by never
 * hiding the bar and skipping the slide animation.
 */
export function ScrollAwareHeader({
  children,
  className,
  topClassName,
  floatingClassName,
  hideThreshold = 140,
}: {
  children: ReactNode;
  className?: string;
  topClassName?: string;
  floatingClassName?: string;
  hideThreshold?: number;
}) {
  const reduceMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() ?? 0;
    setScrolled(latest > 8);

    if (reduceMotion) {
      setHidden(false);
      return;
    }

    if (latest > previous && latest > hideThreshold) {
      setHidden(true);
    } else if (latest < previous) {
      setHidden(false);
    }
  });

  return (
    <motion.header
      className={cn("sticky top-0 z-40", scrolled ? "pt-2" : "")}
      initial={false}
      animate={{ y: hidden ? "-115%" : 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.4, ease: REVEAL_EASE }}
    >
      <div
        data-scrolled={scrolled ? "true" : "false"}
        className={cn(
          "transition-[margin,border-radius,box-shadow,background-color,border-color] duration-300 ease-out",
          className,
          scrolled ? floatingClassName : topClassName,
        )}
      >
        {children}
      </div>
    </motion.header>
  );
}
