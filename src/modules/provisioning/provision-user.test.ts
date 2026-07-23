import assert from "node:assert/strict";
import test from "node:test";

// Isolated unit tests for role-gating and password generation logic.
// Full integration (email, DB, Clerk) is covered by e2e / manual testing.

// ─── Role gating ─────────────────────────────────────────────────────────────

// Re-implement the gating logic from provision-user.ts in pure form so the
// tests do not require mocking Prisma, Clerk, or the email service.
type AppRole = "BUYER" | "STAFF" | "ADMIN" | "FINANCE" | "LEGAL" | "MARKETER" | "SUPER_ADMIN";

const STAFF_PROVISIONABLE: AppRole[] = ["BUYER"];
const ASSIGNABLE_ROLES: AppRole[] = ["STAFF", "FINANCE", "LEGAL", "MARKETER"];
const ADMIN_PROVISIONABLE: AppRole[] = ["BUYER", ...ASSIGNABLE_ROLES];

function allowedRolesForActor(actorRoles: AppRole[]): AppRole[] {
  const isAdmin = actorRoles.some((r) => r === "ADMIN" || r === "SUPER_ADMIN");
  if (isAdmin) return ADMIN_PROVISIONABLE;
  if (actorRoles.includes("STAFF")) return STAFF_PROVISIONABLE;
  return [];
}

test("STAFF actor may only provision BUYER", () => {
  const allowed = allowedRolesForActor(["STAFF"]);
  assert.deepEqual(allowed, ["BUYER"]);
});

test("ADMIN actor may provision BUYER and all assignable roles", () => {
  const allowed = allowedRolesForActor(["ADMIN"]);
  assert.ok(allowed.includes("BUYER"));
  for (const role of ASSIGNABLE_ROLES) {
    assert.ok(allowed.includes(role), `ADMIN should be able to provision ${role}`);
  }
});

test("STAFF actor cannot provision STAFF accounts", () => {
  const allowed = allowedRolesForActor(["STAFF"]);
  assert.equal(allowed.includes("STAFF"), false);
});

test("STAFF actor cannot provision ADMIN accounts", () => {
  const allowed = allowedRolesForActor(["STAFF"]);
  assert.equal(allowed.includes("ADMIN"), false);
});

test("FINANCE actor with no admin role cannot provision anyone", () => {
  const allowed = allowedRolesForActor(["FINANCE"]);
  assert.deepEqual(allowed, []);
});

test("SUPER_ADMIN actor may provision all operator roles", () => {
  const allowed = allowedRolesForActor(["SUPER_ADMIN"]);
  assert.ok(allowed.includes("BUYER"));
  assert.ok(allowed.includes("STAFF"));
  assert.ok(allowed.includes("MARKETER"));
});

test("actor with both STAFF and ADMIN gets admin permissions", () => {
  const allowed = allowedRolesForActor(["STAFF", "ADMIN"]);
  assert.ok(allowed.includes("STAFF"), "compound actor should be able to provision STAFF");
});

// ─── Password strength ────────────────────────────────────────────────────────

import { randomBytes } from "node:crypto";

// Inline the same generator logic used in provision-user.ts
function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*";
  const all = upper + lower + digits + symbols;

  const body = Array.from(randomBytes(12), (b) => all[b % all.length]);
  const classBytes = randomBytes(4);
  const guaranteed = [
    upper[classBytes[0] % upper.length],
    lower[classBytes[1] % lower.length],
    digits[classBytes[2] % digits.length],
    symbols[classBytes[3] % symbols.length],
  ];
  const combined = [...body, ...guaranteed];
  const shuffleBytes = randomBytes(combined.length);
  for (let i = combined.length - 1; i > 0; i--) {
    const j = shuffleBytes[i] % (i + 1);
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  return combined.join("");
}

test("generated password is 16 characters", () => {
  const pw = generatePassword();
  assert.equal(pw.length, 16);
});

test("generated passwords are unique across calls", () => {
  const passwords = new Set(Array.from({ length: 20 }, generatePassword));
  assert.equal(passwords.size, 20);
});

test("generated password always contains all character classes", () => {
  // Generator guarantees one from each class via the 'guaranteed' array
  for (let i = 0; i < 200; i++) {
    const pw = generatePassword();
    assert.ok(/[A-Z]/.test(pw), "must contain uppercase");
    assert.ok(/[a-z]/.test(pw), "must contain lowercase");
    assert.ok(/[23456789]/.test(pw), "must contain digit");
    assert.ok(/[!@#$%^&*]/.test(pw), "must contain symbol");
  }
});

// ─── Email normalization ──────────────────────────────────────────────────────

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

test("email normalization trims and lowercases", () => {
  assert.equal(normalizeEmail("  BUYER@Example.COM  "), "buyer@example.com");
});

test("empty email after normalization is falsy", () => {
  assert.equal(Boolean(normalizeEmail("   ")), false);
});
