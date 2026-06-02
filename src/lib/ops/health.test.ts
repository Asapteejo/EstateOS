import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDatabaseReadinessMetadata,
  buildDependencySummary,
  buildHealthSnapshot,
  buildRuntimeReadinessSummary,
  getMissingExpectedMigrations,
} from "@/lib/ops/health";

test("health snapshot returns safe operational metadata", () => {
  const snapshot = buildHealthSnapshot();

  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.service, "EstateOS");
  assert.match(snapshot.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test("dependency summary stays non-secret and status-oriented", () => {
  const summary = buildDependencySummary();

  assert.equal(typeof summary.database, "string");
  assert.equal(typeof summary.paystack, "string");
  assert.equal(typeof summary.redisConfigured, "boolean");
  assert.equal(typeof summary.realtimeTransport, "string");
  assert.equal(typeof summary.realtimeBackplane, "string");
  assert.equal(typeof summary.superadminAllowlist.configured, "boolean");
  assert.equal(typeof summary.superadminAllowlist.count, "number");
  assert.equal(JSON.stringify(summary).includes("key"), false);
});

test("runtime readiness summary remains safe and structured", () => {
  const summary = buildRuntimeReadinessSummary();

  assert.equal(typeof summary.ok, "boolean");
  assert.equal(Array.isArray(summary.issues), true);
  assert.equal(Array.isArray(summary.warnings), true);
});

test("database readiness metadata stays sanitized", () => {
  const metadata = buildDatabaseReadinessMetadata();
  const serialized = JSON.stringify(metadata);

  assert.equal(typeof metadata.runtime.configured, "boolean");
  assert.equal(typeof metadata.direct.configured, "boolean");
  assert.equal(serialized.includes("@"), false);
});

test("migration readiness reports missing production contract migrations", () => {
  assert.deepEqual(
    getMissingExpectedMigrations([
      "0030_communication_wallet_ledger",
      "0031_communication_topups",
      "0032_buyer_portal_kyc_review_metadata",
      "0033_buyer_testimonial_moderation",
      "0034_contract_generation_mvp",
    ]),
    ["0035_contract_template_version_locking"],
  );
  assert.deepEqual(
    getMissingExpectedMigrations([
      "0030_communication_wallet_ledger",
      "0031_communication_topups",
      "0032_buyer_portal_kyc_review_metadata",
      "0033_buyer_testimonial_moderation",
      "0034_contract_generation_mvp",
      "0035_contract_template_version_locking",
    ]),
    [],
  );
});
