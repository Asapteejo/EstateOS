import assert from "node:assert/strict";
import test from "node:test";

import {
  assertProductionDatabaseWriteAllowed,
  getProductionDatabaseSafetyStatus,
  isKnownProductionDatabase,
} from "@/lib/db/production-db-guard";

const PRODUCTION_REF = "epxbejutuodmnsdfvcjr";
const PRODUCTION_HOST = "aws-0-eu-west-1.pooler.supabase.com";

// The production identifiers are configured via environment (no longer
// hardcoded in source), so tests inject them explicitly.
const guardEnv = {
  PRODUCTION_DATABASE_PROJECT_REF: PRODUCTION_REF,
  PRODUCTION_DATABASE_HOST: PRODUCTION_HOST,
};

const productionUrl =
  "postgresql://user:secret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require";

test("production database guard detects configured production host and project ref", () => {
  assert.equal(
    isKnownProductionDatabase({ ...guardEnv, DATABASE_URL: productionUrl }),
    true,
  );
  assert.equal(
    isKnownProductionDatabase({
      ...guardEnv,
      DATABASE_URL: "postgresql://user:secret@db.epxbejutuodmnsdfvcjr.supabase.co:5432/postgres",
    }),
    true,
  );
});

test("guard fails open when no production identifier is configured", () => {
  assert.equal(isKnownProductionDatabase({ DATABASE_URL: productionUrl }), false);
  assert.equal(
    getProductionDatabaseSafetyStatus({
      NODE_ENV: "development",
      DATABASE_URL: productionUrl,
    }).sharedDatabaseRisk,
    false,
  );
});

test("local writes are blocked when development points at production", () => {
  assert.equal(
    getProductionDatabaseSafetyStatus({
      ...guardEnv,
      NODE_ENV: "development",
      DATABASE_URL: productionUrl,
    }).sharedDatabaseRisk,
    true,
  );
  assert.throws(
    () =>
      assertProductionDatabaseWriteAllowed({
        operation: "Create demo user",
        env: { ...guardEnv, NODE_ENV: "development", DATABASE_URL: productionUrl },
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
        ...guardEnv,
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
          ...guardEnv,
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
      env: { ...guardEnv, NODE_ENV: "production", DATABASE_URL: productionUrl },
    }),
  );
});
