import assert from "node:assert/strict";
import test from "node:test";

import {
  assertProductionDatabaseWriteAllowed,
  getProductionDatabaseSafetyStatus,
  isKnownProductionDatabase,
} from "@/lib/db/production-db-guard";

const productionUrl =
  "postgresql://user:secret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require";

test("production database guard detects configured production host and project ref", () => {
  assert.equal(isKnownProductionDatabase({ DATABASE_URL: productionUrl }), true);
  assert.equal(
    isKnownProductionDatabase({
      DATABASE_URL: "postgresql://user:secret@db.epxbejutuodmnsdfvcjr.supabase.co:5432/postgres",
    }),
    true,
  );
});

test("local writes are blocked when development points at production", () => {
  assert.equal(
    getProductionDatabaseSafetyStatus({ NODE_ENV: "development", DATABASE_URL: productionUrl })
      .sharedDatabaseRisk,
    true,
  );
  assert.throws(
    () =>
      assertProductionDatabaseWriteAllowed({
        operation: "Create demo user",
        env: { NODE_ENV: "development", DATABASE_URL: productionUrl },
      }),
    /blocked/,
  );
});

test("non-destructive local writes require explicit override", () => {
  assert.doesNotThrow(() =>
    assertProductionDatabaseWriteAllowed({
      operation: "Create QA fixture",
      allowExplicitOverride: true,
      env: {
        NODE_ENV: "development",
        DATABASE_URL: productionUrl,
        ALLOW_PRODUCTION_DB_WRITES: "true",
      },
    }),
  );
});

test("destructive seed is always blocked against production database", () => {
  assert.throws(
    () =>
      assertProductionDatabaseWriteAllowed({
        operation: "Run destructive seed",
        destructive: true,
        allowExplicitOverride: true,
        env: {
          NODE_ENV: "development",
          DATABASE_URL: productionUrl,
          ALLOW_PRODUCTION_DB_WRITES: "true",
        },
      }),
    /blocked permanently/,
  );
});

test("production runtime writes continue normally", () => {
  assert.doesNotThrow(() =>
    assertProductionDatabaseWriteAllowed({
      operation: "Persist live transaction",
      env: { NODE_ENV: "production", DATABASE_URL: productionUrl },
    }),
  );
});
