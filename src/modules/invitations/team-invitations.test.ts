import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  assertInvitableRole,
  INVITATION_MIGRATION_PENDING_MESSAGE,
  invitationExpiresAt,
  invitationErrorStatus,
  isInvitationMigrationPendingError,
  SUPERADMIN_INVITABLE_ROLES,
  TEAM_INVITATION_TTL_DAYS,
} from "@/modules/invitations/team-invitations";
import {
  getInvitationAcceptanceFailure,
  hasMatchingVerifiedInvitationEmail,
} from "@/lib/auth/invitation-email";

test("superadmin invitation role policy allows only admin and staff", () => {
  assert.doesNotThrow(() => assertInvitableRole("ADMIN", SUPERADMIN_INVITABLE_ROLES));
  assert.doesNotThrow(() => assertInvitableRole("STAFF", SUPERADMIN_INVITABLE_ROLES));
  assert.throws(() => assertInvitableRole("FINANCE", SUPERADMIN_INVITABLE_ROLES), /cannot be invited/i);
  assert.throws(() => assertInvitableRole("SUPER_ADMIN", SUPERADMIN_INVITABLE_ROLES), /cannot be invited/i);
});

test("team invitations expire after seven days", () => {
  const now = new Date("2026-06-03T00:00:00.000Z");
  const expiresAt = invitationExpiresAt(now);

  assert.equal(TEAM_INVITATION_TTL_DAYS, 7);
  assert.equal(expiresAt.toISOString(), "2026-06-10T00:00:00.000Z");
});

test("invitation email mismatch and unverified email are rejected", () => {
  assert.equal(
    hasMatchingVerifiedInvitationEmail("admin@example.com", [
      { emailAddress: "other@example.com", verification: { status: "verified" } },
    ]),
    false,
  );
  assert.equal(
    hasMatchingVerifiedInvitationEmail("admin@example.com", [
      { emailAddress: "admin@example.com", verification: { status: "unverified" } },
    ]),
    false,
  );
});

test("expired and replayed invitations are rejected by acceptance policy", () => {
  assert.deepEqual(
    getInvitationAcceptanceFailure({
      role: "ADMIN",
      status: "PENDING",
      expiresAt: new Date("2026-06-02T00:00:00.000Z"),
      now: new Date("2026-06-03T00:00:00.000Z"),
    }),
    { message: "This invitation has expired.", status: 410 },
  );
  assert.deepEqual(
    getInvitationAcceptanceFailure({
      role: "ADMIN",
      status: "ACCEPTED",
      expiresAt: new Date("2026-06-10T00:00:00.000Z"),
    }),
    { message: "This invitation has already been accepted.", status: 409 },
  );
});

test("pending invitation migration errors are reported safely", () => {
  const prismaError = {
    code: "P2022",
    message: "The column `branchId` does not exist in the current database.",
  };
  const migrationError = new Error(INVITATION_MIGRATION_PENDING_MESSAGE) as Error & { status?: number };
  migrationError.status = 503;

  assert.equal(isInvitationMigrationPendingError(prismaError), true);
  assert.equal(isInvitationMigrationPendingError(new Error("The column branchId does not exist")), true);
  assert.equal(isInvitationMigrationPendingError(new Error("Other failure")), false);
  assert.equal(invitationErrorStatus(migrationError), 503);
});

test("successful invitation acceptance remains atomic and role-assigning", () => {
  const source = readFileSync(join(process.cwd(), "src", "modules", "invitations", "team-invitations.ts"), "utf8");

  assert.match(source, /teamMemberInvitation\.updateMany/);
  assert.match(source, /status: "PENDING"/);
  assert.match(source, /data: \{ status: "ACCEPTED"/);
  assert.match(source, /role\.upsert/);
  assert.match(source, /userRole\.upsert/);
  assert.match(source, /syncAuthenticatedClerkUser/);
});

test("superadmin company page exposes the invite action without weakening superadmin guard", () => {
  const page = readFileSync(
    join(process.cwd(), "src", "app", "(superadmin)", "superadmin", "companies", "[companyId]", "page.tsx"),
    "utf8",
  );
  const actions = readFileSync(
    join(process.cwd(), "src", "app", "(superadmin)", "superadmin", "companies", "actions.ts"),
    "utf8",
  );

  assert.match(page, /inviteCompanyAdminFromSuperadminAction/);
  assert.match(actions, /requireSuperAdminSession/);
  assert.match(actions, /SUPERADMIN_INVITABLE_ROLES/);
});
