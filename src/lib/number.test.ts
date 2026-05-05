import assert from "node:assert/strict";
import test from "node:test";

import { parseFlexibleNumber } from "@/lib/number";

test("parseFlexibleNumber accepts common currency and separator formats", () => {
  assert.equal(parseFlexibleNumber("25000000"), 25000000);
  assert.equal(parseFlexibleNumber("25,000,000"), 25000000);
  assert.equal(parseFlexibleNumber("₦25,000,000"), 25000000);
  assert.equal(parseFlexibleNumber("$120,000"), 120000);
});

test("parseFlexibleNumber treats empty and invalid input as missing", () => {
  assert.equal(parseFlexibleNumber(""), undefined);
  assert.equal(parseFlexibleNumber("   "), undefined);
  assert.equal(parseFlexibleNumber("not a number"), undefined);
  assert.equal(parseFlexibleNumber(Number.NaN), undefined);
});
