import assert from "node:assert/strict";
import test from "node:test";

import { resolveAuditActorForWrite } from "@/lib/audit/service";

test("audit actor resolver uses an existing database user id", () => {
  assert.equal(
    resolveAuditActorForWrite({
      requestedActorUserId: "clerk_or_dev_user",
      resolvedActorUserId: "user_db_id",
      isProduction: true,
    }),
    "user_db_id",
  );
});

test("audit actor resolver omits missing synthetic actors outside production", () => {
  assert.equal(
    resolveAuditActorForWrite({
      requestedActorUserId: "demo-superadmin",
      resolvedActorUserId: null,
      isProduction: false,
    }),
    undefined,
  );
});

test("audit actor resolver remains strict for missing actors in production", () => {
  assert.throws(
    () =>
      resolveAuditActorForWrite({
        requestedActorUserId: "missing-production-user",
        resolvedActorUserId: null,
        isProduction: true,
      }),
    /Audit actor user does not exist/,
  );
});

test("audit actor resolver supports system actions without actor", () => {
  assert.equal(
    resolveAuditActorForWrite({
      resolvedActorUserId: null,
      isProduction: true,
    }),
    undefined,
  );
});
