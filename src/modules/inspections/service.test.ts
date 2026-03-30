import test from "node:test";
import assert from "node:assert/strict";

import { canTransitionInspectionStatus } from "@/modules/inspections/service";

test("inspection transitions support request, confirm, reschedule, and completion flow", () => {
  assert.equal(canTransitionInspectionStatus("REQUESTED", "CONFIRMED"), true);
  assert.equal(canTransitionInspectionStatus("CONFIRMED", "RESCHEDULED"), true);
  assert.equal(canTransitionInspectionStatus("RESCHEDULED", "COMPLETED"), true);
});

test("inspection transitions block reopening completed records", () => {
  assert.equal(canTransitionInspectionStatus("COMPLETED", "CONFIRMED"), false);
  assert.equal(canTransitionInspectionStatus("CANCELLED", "REQUESTED"), false);
});
