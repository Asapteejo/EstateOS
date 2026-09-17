import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDatabaseReadinessMetadata,
  buildDependencySummary,
  buildHealthSnapshot,
  buildRuntimeReadinessSummary,
  getMissingExpectedMigrations,
  EXPECTED_PRODUCTION_MIGRATIONS,
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

test("migration readiness reports every migration missing from the database", () => {
  // A database with nothing applied is missing the whole manifest.
  assert.equal(
    getMissingExpectedMigrations([]).length,
    EXPECTED_PRODUCTION_MIGRATIONS.length,
  );

  // A database with everything applied is clean.
  assert.deepEqual(getMissingExpectedMigrations([...EXPECTED_PRODUCTION_MIGRATIONS]), []);

  // Exactly one gap is reported as exactly one missing migration.
  const allButLast = EXPECTED_PRODUCTION_MIGRATIONS.slice(0, -1);
  assert.deepEqual(getMissingExpectedMigrations([...allButLast]), [
    EXPECTED_PRODUCTION_MIGRATIONS[EXPECTED_PRODUCTION_MIGRATIONS.length - 1],
  ]);
});

/**
 * Regression test for the production incident: the expected-migrations list
 * was hand-maintained, stopped at 0035, and reported a false green while the
 * database was missing 0042 — whose absent columns produced P2022
 * "column does not exist" 500s.
 */
test("migration manifest covers the CMS migration that caused the P2022 incident", () => {
  assert.ok(
    EXPECTED_PRODUCTION_MIGRATIONS.includes("0042_site_content_cms"),
    "0042_site_content_cms must be in the manifest or readyz cannot detect the drift that broke production.",
  );

  // A database stuck at 0035 must now be reported as drifted, not healthy.
  const stuckAt0035 = EXPECTED_PRODUCTION_MIGRATIONS.slice(
    0,
    EXPECTED_PRODUCTION_MIGRATIONS.indexOf("0035_contract_template_version_locking") + 1,
  );
  const missing = getMissingExpectedMigrations([...stuckAt0035]);

  assert.ok(missing.length > 0, "A database behind the code must never report zero missing migrations.");
  assert.ok(missing.includes("0042_site_content_cms"));
});

test("migration manifest is generated, sorted, and free of duplicates", () => {
  const names = [...EXPECTED_PRODUCTION_MIGRATIONS];

  assert.ok(names.length > 40, "Manifest looks truncated; regenerate it.");
  assert.equal(new Set(names).size, names.length, "Duplicate migration names in the manifest.");
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
});
