import test from "node:test";
import assert from "node:assert/strict";

import {
  assertProductionRuntimeEnv,
  buildFeatureFlags,
  getProductionReadinessIssues,
  parsePublicEnv,
  parseServerEnv,
} from "@/lib/config";

test("server env requires complete grouped service config", () => {
  assert.throws(
    () =>
      parseServerEnv({
        NODE_ENV: "development",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        PAYSTACK_SECRET_KEY: "secret-only",
      }),
    /Paystack configuration is incomplete/,
  );
});

test("production env parse allows build-time config inspection", () => {
  const env = parseServerEnv({
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "https://estateos.example.com",
  });

  assert.equal(env.NODE_ENV, "production");
});

test("production readiness reports missing critical services", () => {
  const env = parseServerEnv({
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "https://estateos.example.com",
  });

  const issues = getProductionReadinessIssues(env);

  assert.equal(issues.some((issue) => issue.includes("DATABASE_URL")), true);
  assert.equal(issues.some((issue) => issue.includes("clerk")), true);
});

test("production runtime assertion fails on missing critical services", () => {
  const env = parseServerEnv({
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "https://estateos.example.com",
  });

  assert.throws(() => assertProductionRuntimeEnv(env), /Invalid production runtime environment/);
});

test("public env exposes only client-safe values", () => {
  const env = parsePublicEnv({
    NODE_ENV: "development",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_PORTAL_BASE_URL: "http://localhost:3001",
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: "public-mapbox",
  });

  assert.equal(env.NEXT_PUBLIC_APP_URL, "http://localhost:3000");
  assert.equal(env.NEXT_PUBLIC_PORTAL_BASE_URL, "http://localhost:3001");
  assert.equal(env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN, "public-mapbox");
});

test("feature flags require full service groups", () => {
  const env = parseServerEnv({
    NODE_ENV: "development",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/realestate_platform?schema=public",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test",
    CLERK_SECRET_KEY: "sk_test",
    CLERK_WEBHOOK_SECRET: "whsec_test",
  });

  const flags = buildFeatureFlags(env);

  assert.equal(flags.hasDatabase, true);
  assert.equal(flags.hasClerk, true);
  assert.equal(flags.hasPaystack, false);
});

test("server env derives platform and portal base urls from public values", () => {
  const env = parseServerEnv({
    NODE_ENV: "development",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_PLATFORM_BASE_URL: "https://estateos.example.com",
    NEXT_PUBLIC_PORTAL_BASE_URL: "https://portal.estateos.example.com",
  });

  assert.equal(env.APP_BASE_URL, "http://localhost:3000");
  assert.equal(env.PLATFORM_BASE_URL, "https://estateos.example.com");
  assert.equal(env.PORTAL_BASE_URL, "https://portal.estateos.example.com");
});
