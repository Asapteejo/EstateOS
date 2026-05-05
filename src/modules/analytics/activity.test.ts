import assert from "node:assert/strict";
import test from "node:test";

import { resolveActivityUserForWrite } from "@/modules/analytics/activity";

test("activity event user resolver uses an existing database user id", () => {
  assert.equal(
    resolveActivityUserForWrite({
      requestedUserId: "demo-admin",
      resolvedUserId: "user_db_id",
      isProduction: true,
    }),
    "user_db_id",
  );
});

test("activity event user resolver omits missing synthetic users outside production", () => {
  assert.equal(
    resolveActivityUserForWrite({
      requestedUserId: "demo-superadmin",
      resolvedUserId: null,
      isProduction: false,
    }),
    null,
  );
});

test("activity event user resolver remains strict in production", () => {
  assert.throws(
    () =>
      resolveActivityUserForWrite({
        requestedUserId: "missing-clerk-user",
        resolvedUserId: null,
        isProduction: true,
      }),
    /Activity event user does not exist/,
  );
});

test("activity event user resolver supports system events", () => {
  assert.equal(
    resolveActivityUserForWrite({
      requestedUserId: null,
      resolvedUserId: null,
      isProduction: true,
    }),
    null,
  );
});
