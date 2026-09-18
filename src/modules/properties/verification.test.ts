import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPropertyVerificationPresentation,
  buildPropertyVerificationUpdateInput,
  buildPublicPropertyVerificationWhere,
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

test("public visibility filter falls back to the stored flags without a cutoff", () => {
  const where = buildPublicPropertyVerificationWhere();

  assert.deepEqual(where, {
    isPubliclyVisible: true,
    verificationStatus: { in: ["VERIFIED", "STALE"] },
  });
});

test("public visibility filter drops listings that aged past the hide window", () => {
  // The stored flags are only written when a property is mutated, so a listing
  // that crossed the hide threshold kept `isPubliclyVisible: true` and stayed
  // public while rendering "Listing hidden". The cutoff applies the same rule
  // the presentation uses, in the query.
  const thresholds = normalizeVerificationThresholds({ freshDays: 5, staleDays: 10, hideDays: 12 });
  const hideBefore = new Date(now.getTime() - thresholds.hideDays * 24 * 60 * 60 * 1000);
  const where = buildPublicPropertyVerificationWhere({ hideBefore }) as {
    lastVerifiedAt?: { gte: Date };
  };

  assert.deepEqual(where.lastVerifiedAt, { gte: hideBefore });

  // A listing last verified before the cutoff is exactly the one the
  // presentation would label "Listing hidden".
  const agedOut = new Date("2026-03-20T00:00:00.000Z");
  assert.equal(agedOut < hideBefore, true);
  assert.equal(
    computeVerificationStatus({ lastVerifiedAt: agedOut }, thresholds, now),
    "HIDDEN",
  );

  const stillPublic = new Date("2026-03-25T00:00:00.000Z");
  assert.equal(stillPublic >= hideBefore, true);
  assert.notEqual(
    computeVerificationStatus({ lastVerifiedAt: stillPublic }, thresholds, now),
    "HIDDEN",
  );
});
