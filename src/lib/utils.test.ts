import assert from "node:assert/strict";
import test from "node:test";

import { formatCurrency, formatStableDate } from "@/lib/utils";

test("formatStableDate renders deterministic en-GB dates", () => {
  assert.equal(formatStableDate("2026-04-28T16:40:15.198Z"), "28/04/2026");
});

test("formatCurrency renders deterministic supported currencies", () => {
  assert.equal(formatCurrency(120000, "USD"), "$120,000");
  assert.equal(formatCurrency(25000000, "NGN"), "NGN 25,000,000");
});
