import assert from "node:assert/strict";
import test from "node:test";

import { getPropertyCountdownParts } from "@/modules/properties/countdown";

test("property countdown reports future remaining time", () => {
  const now = new Date("2026-04-29T12:00:00.000Z").getTime();
  const target = new Date("2026-05-03T15:20:00.000Z").getTime();

  assert.deepEqual(getPropertyCountdownParts(target, now), {
    days: 4,
    hours: 3,
    minutes: 20,
    expired: false,
  });
});

test("property countdown reports expired offers safely", () => {
  const now = new Date("2026-04-29T12:00:00.000Z").getTime();
  const target = new Date("2026-04-28T12:00:00.000Z").getTime();

  assert.deepEqual(getPropertyCountdownParts(target, now), {
    days: 0,
    hours: 0,
    minutes: 0,
    expired: true,
  });
});

