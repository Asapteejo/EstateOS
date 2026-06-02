import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

const loadingFiles = [
  "src/app/(superadmin)/superadmin/loading.tsx",
  "src/app/(superadmin)/superadmin/settings/loading.tsx",
  "src/app/(superadmin)/superadmin/activity/loading.tsx",
  "src/app/(superadmin)/superadmin/companies/loading.tsx",
  "src/app/(superadmin)/superadmin/revenue/loading.tsx",
  "src/app/(superadmin)/superadmin/communication-wallets/loading.tsx",
];

test("superadmin routes expose immediate loading states", () => {
  for (const file of loadingFiles) {
    assert.equal(existsSync(file), true, `${file} should exist`);
  }
});
