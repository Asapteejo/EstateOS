import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDependencySummary,
  buildHealthSnapshot,
  buildRuntimeReadinessSummary,
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
  assert.equal(Object.values(summary).every((value) => !value.includes("key")), true);
});

test("runtime readiness summary remains safe and structured", () => {
  const summary = buildRuntimeReadinessSummary();

  assert.equal(typeof summary.ok, "boolean");
  assert.equal(Array.isArray(summary.issues), true);
});
