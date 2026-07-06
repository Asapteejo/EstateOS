/** Cadence for the cheap version-check poll (one Redis GET server-side). */
export const REALTIME_VERSION_POLL_INTERVAL_MS = 15_000;

/** Minimum spacing between BLIND refreshes (fallback when counters are off). */
export const REALTIME_REFRESH_INTERVAL_MS = 30_000;

/**
 * Minimum spacing between refreshes triggered by an actual version change.
 * Shorter than the blind interval on purpose: when we KNOW something changed,
 * re-render promptly — the floor only debounces event bursts.
 */
export const REALTIME_CHANGE_REFRESH_MIN_INTERVAL_MS = 5_000;

export function shouldRefreshRealtime(input: {
  now: number;
  lastRefreshAt: number;
  hidden: boolean;
  pending: boolean;
  /** Spacing floor to apply; defaults to the blind-refresh interval. */
  minIntervalMs?: number;
}) {
  return (
    !input.hidden &&
    !input.pending &&
    input.now - input.lastRefreshAt >= (input.minIntervalMs ?? REALTIME_REFRESH_INTERVAL_MS)
  );
}
