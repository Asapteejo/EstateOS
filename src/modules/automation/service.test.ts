import test from "node:test";
import assert from "node:assert/strict";

import { isInspectionReminderDue, isPaymentReminderDue } from "@/modules/automation/service";

test("payment reminder becomes due when next payment date has passed and no recent reminder exists", () => {
  assert.equal(
    isPaymentReminderDue({
      nextPaymentDueAt: new Date("2026-04-01T00:00:00.000Z"),
      lastPaymentReminderAt: null,
      paymentStatus: "PARTIAL",
      outstandingBalance: 200000,
      now: new Date("2026-04-02T00:00:00.000Z"),
    }),
    true,
  );
});

test("inspection reminder is due within 24 hours for confirmed visits", () => {
  assert.equal(
    isInspectionReminderDue({
      scheduledFor: new Date("2026-04-02T10:00:00.000Z"),
      reminderSentAt: null,
      status: "CONFIRMED",
      now: new Date("2026-04-01T12:00:00.000Z"),
    }),
    true,
  );

  assert.equal(
    isInspectionReminderDue({
      scheduledFor: new Date("2026-04-04T10:00:00.000Z"),
      reminderSentAt: null,
      status: "CONFIRMED",
      now: new Date("2026-04-01T12:00:00.000Z"),
    }),
    false,
  );
});
