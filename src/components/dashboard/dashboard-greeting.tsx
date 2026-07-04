"use client";

import { useSyncExternalStore } from "react";

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Personalised, time-aware greeting ("Good morning, Bisi 👋"). The time-of-day
 * word is derived client-side from the viewer's local clock, so a user who signs
 * in at 8am sees "Good morning" regardless of server timezone. The server snapshot
 * returns null so server/client markup stays identical until hydration completes
 * (no hydration mismatch). The wave is decorative and hidden from assistive tech.
 */
export function DashboardGreeting({
  name,
  subtitle,
}: {
  name: string;
  subtitle?: string;
}) {
  const word = useSyncExternalStore(
    () => () => {},
    () => greetingForHour(new Date().getHours()),
    () => null,
  );

  return (
    <div className="min-w-0">
      <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--ink-950)] sm:text-3xl">
        <span className="truncate">
          {word ?? "Hello"}, {name}
        </span>
        <span aria-hidden className="shrink-0 text-2xl sm:text-3xl">
          &#128075;
        </span>
      </h2>
      {subtitle ? (
        <p className="mt-1 text-sm text-[var(--ink-500)]">{subtitle}</p>
      ) : null}
    </div>
  );
}
