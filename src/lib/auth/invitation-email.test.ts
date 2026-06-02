import assert from "node:assert/strict";
import test from "node:test";

import {
  hasMatchingVerifiedInvitationEmail,
  getInvitationAcceptanceFailure,
  normalizeInvitationEmail,
} from "@/lib/auth/invitation-email";

test("invitation email matching normalizes casing and whitespace", () => {
  assert.equal(normalizeInvitationEmail(" Owner@Example.com "), "owner@example.com");
  assert.equal(
    hasMatchingVerifiedInvitationEmail("Owner@Example.com", [
      { emailAddress: " owner@example.com ", verification: { status: "verified" } },
    ]),
    true,
  );
});

test("invitation policy rejects expired, reused, and superadmin tokens", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");
  assert.equal(
    getInvitationAcceptanceFailure({
      role: "ADMIN",
      status: "PENDING",
      expiresAt: new Date("2026-05-31T00:00:00.000Z"),
      now,
    })?.status,
    410,
  );
  assert.equal(
    getInvitationAcceptanceFailure({
      role: "ADMIN",
      status: "ACCEPTED",
      expiresAt: new Date("2026-06-02T00:00:00.000Z"),
      now,
    })?.status,
    409,
  );
  assert.equal(
    getInvitationAcceptanceFailure({
      role: "SUPER_ADMIN",
      status: "PENDING",
      expiresAt: new Date("2026-06-02T00:00:00.000Z"),
      now,
    })?.status,
    403,
  );
});

test("invitation acceptance rejects different or unverified email addresses", () => {
  assert.equal(
    hasMatchingVerifiedInvitationEmail("owner@example.com", [
      { emailAddress: "other@example.com", verification: { status: "verified" } },
    ]),
    false,
  );
  assert.equal(
    hasMatchingVerifiedInvitationEmail("owner@example.com", [
      { emailAddress: "owner@example.com", verification: { status: "unverified" } },
    ]),
    false,
  );
});
