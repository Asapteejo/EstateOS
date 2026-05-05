"use client";

import { useEffect, useMemo, useState } from "react";

import { getPropertyCountdownParts } from "@/modules/properties/countdown";

export function PropertyCountdown({
  label,
  offerEndsAt,
}: {
  label: string;
  offerEndsAt: string;
}) {
  const targetTime = useMemo(() => new Date(offerEndsAt).getTime(), [offerEndsAt]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  if (!Number.isFinite(targetTime)) {
    return null;
  }

  const countdown = getPropertyCountdownParts(targetTime, now);

  return (
    <div className="rounded-3xl bg-[var(--brand-50)] px-4 py-4 text-sm text-[var(--brand-900)]">
      <div className="font-semibold">{label}</div>
      <div className="mt-2 text-lg font-semibold">
        {countdown.expired
          ? "Offer ended"
          : `${countdown.days}d ${countdown.hours}h ${countdown.minutes}m`}
      </div>
    </div>
  );
}
