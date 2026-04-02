import test from "node:test";
import assert from "node:assert/strict";

import { buildDailyActionCards, deriveColdClientFlag } from "@/modules/admin/control-center";

test("cold client flag requires open intent and stale activity", () => {
  assert.equal(
    deriveColdClientFlag({
      latestActivityAt: new Date("2026-03-20T00:00:00.000Z"),
      hasOpenIntent: true,
      now: new Date("2026-04-02T00:00:00.000Z"),
      staleDays: 5,
    }),
    true,
  );

  assert.equal(
    deriveColdClientFlag({
      latestActivityAt: new Date("2026-04-01T00:00:00.000Z"),
      hasOpenIntent: true,
      now: new Date("2026-04-02T00:00:00.000Z"),
      staleDays: 5,
    }),
    false,
  );
});

test("daily action cards preserve admin action ordering", () => {
  const cards = buildDailyActionCards({
    clientsNeedingFollowUp: 3,
    expiringWishlists: 2,
    upcomingInspections: 4,
    overduePayments: 1,
  });

  assert.equal(cards[0]?.label, "Clients needing follow-up");
  assert.equal(cards[3]?.href, "/admin/payments");
});
