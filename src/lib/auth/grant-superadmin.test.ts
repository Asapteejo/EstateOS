import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAllowlistedSuperadminEmail,
  maskEmail,
  parseGrantSuperadminEmail,
} from "@/lib/auth/grant-superadmin";

test("grant superadmin CLI parses and normalizes the requested email", () => {
  assert.equal(
    parseGrantSuperadminEmail(["--email", " Owner@EstateOS.Tech "]),
    "owner@estateos.tech",
  );
  assert.equal(
    parseGrantSuperadminEmail(["--email=Owner@EstateOS.Tech"]),
    "owner@estateos.tech",
  );
});

test("grant superadmin CLI refuses missing email", () => {
  assert.throws(
    () => parseGrantSuperadminEmail([]),
    /npm run grant:superadmin/,
  );
});

test("grant superadmin CLI refuses email outside normalized allowlist", () => {
  assert.doesNotThrow(() =>
    assertAllowlistedSuperadminEmail(
      "owner@estateos.tech",
      " Owner@EstateOS.Tech, second@example.com ",
    ));
  assert.throws(
    () => assertAllowlistedSuperadminEmail("unknown@example.com", "owner@estateos.tech"),
    /not present in SUPERADMIN_EMAILS/,
  );
});

test("grant superadmin CLI masks email in operator output", () => {
  assert.equal(maskEmail("owner@estateos.tech"), "o***@estateos.tech");
});
