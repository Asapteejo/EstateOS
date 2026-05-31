import assert from "node:assert/strict";
import test from "node:test";

import {
  canAccessSuperadmin,
  isSuperadminEmailAllowlisted,
  parseSuperadminEmails,
  sanitizeSessionRoles,
} from "@/lib/auth/superadmin";

test("superadmin allowlist normalizes whitespace and email casing", () => {
  assert.deepEqual(
    [...parseSuperadminEmails(" Owner@EstateOS.Tech, second@example.com , ")],
    ["owner@estateos.tech", "second@example.com"],
  );
  assert.equal(
    isSuperadminEmailAllowlisted(" OWNER@estateos.tech ", "owner@estateos.tech"),
    true,
  );
});

test("production superadmin access requires both persisted role and allowlisted email", () => {
  assert.equal(canAccessSuperadmin({
    roles: ["SUPER_ADMIN"],
    email: "owner@estateos.tech",
    isProduction: true,
    superadminEmails: "owner@estateos.tech",
    mode: "clerk",
  }), true);
  assert.equal(canAccessSuperadmin({
    roles: ["SUPER_ADMIN"],
    email: "unknown@example.com",
    isProduction: true,
    superadminEmails: "owner@estateos.tech",
    mode: "clerk",
  }), false);
  assert.equal(canAccessSuperadmin({
    roles: ["SUPER_ADMIN"],
    email: "owner@estateos.tech",
    isProduction: true,
    superadminEmails: "",
    mode: "clerk",
  }), false);
});

test("public claims cannot grant superadmin access even for an allowlisted email", () => {
  assert.deepEqual(sanitizeSessionRoles({
    roles: ["BUYER", "SUPER_ADMIN"],
    email: "owner@estateos.tech",
    isProduction: true,
    superadminEmails: "owner@estateos.tech",
    source: "claims",
  }), ["BUYER"]);
});

test("persisted unauthorized superadmin role is removed from production session", () => {
  assert.deepEqual(sanitizeSessionRoles({
    roles: ["ADMIN", "SUPER_ADMIN"],
    email: "unknown@example.com",
    isProduction: true,
    superadminEmails: "owner@estateos.tech",
    source: "database",
  }), ["ADMIN"]);
});

test("demo superadmin bypass is available only outside production", () => {
  assert.equal(canAccessSuperadmin({
    roles: ["SUPER_ADMIN"],
    email: "superadmin@example.com",
    isProduction: false,
    superadminEmails: "",
    mode: "demo",
  }), true);
  assert.equal(canAccessSuperadmin({
    roles: ["SUPER_ADMIN"],
    email: "superadmin@example.com",
    isProduction: true,
    superadminEmails: "superadmin@example.com",
    mode: "demo",
  }), false);
});
