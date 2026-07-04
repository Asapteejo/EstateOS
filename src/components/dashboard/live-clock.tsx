"use client";

import { useEffect, useState } from "react";

/**
 * A live, ticking clock chip ("16:10 | Mon, Jun 29") with a pulsing status dot,
 * giving the dashboard a real-time feel. Time is rendered client-side so it
 * reflects the viewer's local timezone; until mounted it shows a neutral
 * placeholder to avoid a hydration mismatch. Uses tabular figures so the width
 * never jumps as the digits change.
 */
export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const init = setTimeout(tick, 0);
    const id = setInterval(tick, 15_000);
    return () => { clearTimeout(init); clearInterval(id); };
  }, []);

  const time = now
    ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "--:--";
  const date = now
    ? now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })
    : "";

  return (
    <div
      className="inline-flex items-center gap-2.5 rounded-full border border-[var(--line)] bg-[var(--surface-1,#fff)] px-3.5 py-2 text-sm shadow-[var(--shadow-sm)]"
      role="timer"
      aria-label={now ? `Current time ${time}, ${date}` : "Loading current time"}
    >
      <span className="relative grid h-2 w-2 place-items-center" aria-hidden>
        <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-[var(--success-500,#16a34a)] opacity-75 motion-reduce:animate-none" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--success-600,#15803d)]" />
      </span>
      <span className="font-semibold tabular-nums tracking-tight text-[var(--ink-900)]">{time}</span>
      {date ? (
        <>
          <span className="text-[var(--ink-300)]" aria-hidden>|</span>
          <span className="font-medium text-[var(--ink-600)]">{date}</span>
        </>
      ) : null}
    </div>
  );
}
