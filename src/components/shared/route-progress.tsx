"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Thin top-of-page progress bar for perceived navigation speed. Dependency-free
 * and App-Router-friendly:
 *  - starts on same-origin internal link/button clicks (detected via a passive
 *    document click listener),
 *  - eases toward ~90% while the next route loads,
 *  - snaps to 100% and fades out when the pathname actually changes.
 *
 * A safety timer prevents a stuck bar if a navigation is cancelled. The bar is
 * decorative (aria-hidden) and transform/opacity only; the global reduced-motion
 * reset removes the easing, leaving an instant, non-distracting indicator.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startedRef = useRef(false);

  function clearTimers() {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current = [];
  }

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor) {
        return;
      }
      const href = anchor.getAttribute("href");
      if (!href || anchor.getAttribute("target") === "_blank" || anchor.hasAttribute("download")) {
        return;
      }
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) {
        return;
      }

      startedRef.current = true;
      clearTimers();
      setActive(true);
      setWidth(10);
      timers.current.push(setTimeout(() => setWidth(45), 120));
      timers.current.push(setTimeout(() => setWidth(72), 360));
      timers.current.push(setTimeout(() => setWidth(90), 820));
      // Safety: never leave the bar stuck if navigation is cancelled.
      timers.current.push(
        setTimeout(() => {
          startedRef.current = false;
          setActive(false);
          setWidth(0);
        }, 8000),
      );
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    if (!startedRef.current) {
      return;
    }
    startedRef.current = false;
    clearTimers();
    // Defer the state updates out of the effect body (avoids synchronous
    // setState-in-effect): snap to 100%, then fade out.
    const finish = setTimeout(() => setWidth(100), 0);
    const done = setTimeout(() => {
      setActive(false);
      setWidth(0);
    }, 240);
    return () => {
      clearTimeout(finish);
      clearTimeout(done);
    };
  }, [pathname]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[2000] h-0.5 transition-opacity duration-200 ${
        active ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className="h-full rounded-r-full bg-[var(--brand-700)] shadow-[0_0_8px_var(--brand-500)] transition-[width] duration-200 ease-[var(--ease-out)]"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
