import test from "node:test";
import assert from "node:assert/strict";

import {
  REALTIME_REFRESH_INTERVAL_MS,
  shouldRefreshRealtime,
} from "@/lib/realtime/refresh-policy";

test("realtime refresh policy throttles repeated refresh attempts", () => {
  const firstRefreshAt = 100_000;

  assert.equal(
    shouldRefreshRealtime({
      now: firstRefreshAt + REALTIME_REFRESH_INTERVAL_MS,
      lastRefreshAt: firstRefreshAt,
      hidden: false,
      pending: false,
    }),
    true,
  );
  assert.equal(
    shouldRefreshRealtime({
      now: firstRefreshAt + REALTIME_REFRESH_INTERVAL_MS + 1,
      lastRefreshAt: firstRefreshAt + REALTIME_REFRESH_INTERVAL_MS,
      hidden: false,
      pending: false,
    }),
    false,
  );
});

test("realtime refresh policy pauses hidden and pending tabs", () => {
  const input = {
    now: REALTIME_REFRESH_INTERVAL_MS,
    lastRefreshAt: 0,
  };

  assert.equal(shouldRefreshRealtime({ ...input, hidden: true, pending: false }), false);
  assert.equal(shouldRefreshRealtime({ ...input, hidden: false, pending: true }), false);
});
