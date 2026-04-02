import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPropertyVerificationPresentation,
  buildPropertyVerificationUpdateInput,
  computeVerificationStatus,
  normalizeVerificationThresholds,
  updateVerificationState,
} from "@/modules/properties/verification";

const now = new Date("2026-04-02T00:00:00.000Z");

test("verification status is verified within the seven day window", () => {
  assert.equal(
    computeVerificationStatus(
      {
        lastVerifiedAt: new Date("2026-03-28T00:00:00.000Z"),
      },
      undefined,
      now,
    ),
    "VERIFIED",
  );
});

test("verification status becomes stale before the hide window", () => {
  assert.equal(
    computeVerificationStatus(
      {
        lastVerifiedAt: new Date("2026-03-12T00:00:00.000Z"),
      },
      undefined,
      now,
    ),
    "STALE",
  );
});

test("verification status becomes hidden after the hide window", () => {
  assert.equal(
    computeVerificationStatus(
      {
        lastVerifiedAt: new Date("2026-02-10T00:00:00.000Z"),
      },
      undefined,
      now,
    ),
    "HIDDEN",
  );
});

test("updateVerificationState hides unverified properties from public inventory", () => {
  assert.deepEqual(
    updateVerificationState(
      {
        lastVerifiedAt: null,
      },
      undefined,
      now,
    ),
    {
      verificationStatus: "UNVERIFIED",
      verificationDueAt: now,
      isPubliclyVisible: false,
      autoHiddenAt: null,
    },
  );
});

test("verification presentation warns buyers when a listing is stale", () => {
  const presentation = buildPropertyVerificationPresentation(
    {
      lastVerifiedAt: new Date("2026-03-20T00:00:00.000Z"),
      verificationStatus: "STALE",
      verificationDueAt: new Date("2026-03-27T00:00:00.000Z"),
      isPubliclyVisible: true,
      autoHiddenAt: null,
    },
    undefined,
    now,
  );

  assert.equal(presentation.status, "STALE");
  assert.equal(presentation.tone, "warning");
  assert.match(presentation.label, /^Last updated /);
});

test("admin verification input resets public visibility and due date", () => {
  const verifiedAt = new Date("2026-04-02T10:30:00.000Z");
  const input = buildPropertyVerificationUpdateInput(verifiedAt, "Confirmed inventory with branch manager");

  assert.equal(input.verificationStatus, "VERIFIED");
  assert.equal(input.isPubliclyVisible, true);
  assert.equal(input.lastVerifiedAt?.toISOString(), "2026-04-02T10:30:00.000Z");
  assert.equal(input.verificationDueAt.toISOString(), "2026-04-09T10:30:00.000Z");
  assert.equal(input.verificationNotes, "Confirmed inventory with branch manager");
});

test("verification thresholds normalize invalid tenant settings safely", () => {
  const thresholds = normalizeVerificationThresholds({
    freshDays: 10,
    staleDays: 8,
    hideDays: 8,
    warningReminderDays: 99,
  });

  assert.deepEqual(thresholds, {
    freshDays: 10,
    staleDays: 11,
    hideDays: 12,
    warningReminderDays: 11,
  });
});

test("verification status uses tenant-specific fresh and hide windows", () => {
  const status = computeVerificationStatus(
    {
      lastVerifiedAt: new Date("2026-03-20T00:00:00.000Z"),
    },
    {
      freshDays: 5,
      staleDays: 10,
      hideDays: 12,
      warningReminderDays: 2,
    },
    now,
  );

  assert.equal(status, "HIDDEN");
});
