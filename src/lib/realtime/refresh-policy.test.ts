import test from "node:test";
import assert from "node:assert/strict";

import {
  REALTIME_CHANGE_REFRESH_MIN_INTERVAL_MS,
  REALTIME_REFRESH_INTERVAL_MS,
  REALTIME_VERSION_POLL_INTERVAL_MS,
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

test("version-change refreshes use the shorter debounce floor", () => {
  const lastRefreshAt = 100_000;
  const now = lastRefreshAt + REALTIME_CHANGE_REFRESH_MIN_INTERVAL_MS;

  // Blind spacing would still block here...
  assert.equal(
    shouldRefreshRealtime({ now, lastRefreshAt, hidden: false, pending: false }),
    false,
  );
  // ...but a detected change may refresh after the short floor.
  assert.equal(
    shouldRefreshRealtime({
      now,
      lastRefreshAt,
      hidden: false,
      pending: false,
      minIntervalMs: REALTIME_CHANGE_REFRESH_MIN_INTERVAL_MS,
    }),
    true,
  );
});

test("interval constants stay ordered (debounce < poll < blind)", () => {
  assert.ok(REALTIME_CHANGE_REFRESH_MIN_INTERVAL_MS < REALTIME_VERSION_POLL_INTERVAL_MS);
  assert.ok(REALTIME_VERSION_POLL_INTERVAL_MS < REALTIME_REFRESH_INTERVAL_MS);
});
