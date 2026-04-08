import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateConversionRate,
  calculateRecoveryRate,
  parseAnalyticsRange,
} from "@/modules/analytics/aggregates";

test("analytics range parsing defaults safely", () => {
  assert.equal(parseAnalyticsRange("7d"), "7d");
  assert.equal(parseAnalyticsRange("unknown"), "30d");
});

test("conversion rate handles empty denominator", () => {
  assert.equal(calculateConversionRate(3, 0), 0);
  assert.equal(calculateConversionRate(3, 4), 75);
});

test("recovery rate uses recovered plus current overdue", () => {
  assert.equal(calculateRecoveryRate(0, 0), 0);
  assert.equal(calculateRecoveryRate(250000, 250000), 50);
});
