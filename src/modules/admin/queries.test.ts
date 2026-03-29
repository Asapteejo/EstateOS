import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAdminAuditLogWhere,
  buildAdminNotificationWhere,
} from "@/modules/admin/queries";

test("admin audit log query remains tenant-scopable without extra leakage filters", () => {
  assert.deepEqual(buildAdminAuditLogWhere(), {});
});

test("admin notification query restricts to operator-relevant channels", () => {
  assert.deepEqual(buildAdminNotificationWhere(), {
    channel: {
      in: ["IN_APP", "EMAIL"],
    },
  });
});
