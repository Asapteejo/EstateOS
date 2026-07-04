"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * An honest "Live" indicator that also DOES the refreshing. It periodically calls
 * router.refresh() so server-rendered data (recent payments, balances, logs)
 * updates without a manual reload. Polling pauses while the tab is hidden to
 * avoid wasted work, and resumes — with an immediate refresh — when the tab is
 * focused again. The dot pulses continuously; during an actual refresh the chip
 * shows a brief "Updating…" state so the label reflects real activity.
 */
export function LiveRefresh({
  intervalMs = 20_000,
  label = "Live",
}: {
  intervalMs?: number;
  label?: string;
}) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      setUpdating(true);
      router.refresh();
      // Clear the "Updating…" flash shortly after; the server round-trip is fast
      // and we only want a subtle acknowledgement, not a persistent spinner.
      window.setTimeout(() => setUpdating(false), 600);
    };

    const start = () => {
      if (timer.current) return;
      timer.current = setInterval(refresh, intervalMs);
    };
    const stop = () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
        start();
      } else {
        stop();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, router]);

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--success-50,#ecfdf5)] px-2.5 py-1 text-xs font-medium text-[var(--success-700,#15803d)]"
      role="status"
      aria-live="polite"
    >
      <span className="relative grid h-1.5 w-1.5 place-items-center" aria-hidden>
        <span className="absolute inline-flex h-1.5 w-1.5 animate-ping rounded-full bg-[var(--success-600,#16a34a)] opacity-75 motion-reduce:animate-none" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--success-600,#16a34a)]" />
      </span>
      {updating ? "Updating…" : label}
    </span>
  );
}
