export const REALTIME_REFRESH_INTERVAL_MS = 30_000;

export function shouldRefreshRealtime(input: {
  now: number;
  lastRefreshAt: number;
  hidden: boolean;
  pending: boolean;
}) {
  return (
    !input.hidden &&
    !input.pending &&
    input.now - input.lastRefreshAt >= REALTIME_REFRESH_INTERVAL_MS
  );
}
