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

test("partial Twilio config does not fail parse unless Twilio is explicitly enabled", () => {
  const env = parseServerEnv({
    NODE_ENV: "development",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    TWILIO_WHATSAPP_FROM: "whatsapp:+14155238886",
  });

  const flags = buildFeatureFlags(env);

  assert.equal(flags.hasTwilio, false);
});

test("Twilio requires a complete config group when explicitly enabled", () => {
  assert.throws(
    () =>
      parseServerEnv({
        NODE_ENV: "development",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        TWILIO_ENABLED: "true",
        TWILIO_WHATSAPP_FROM: "whatsapp:+14155238886",
      }),
    /Twilio configuration is incomplete/,
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

test("server env accepts separate pooled and direct database urls", () => {
  const env = parseServerEnv({
    NODE_ENV: "development",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    DATABASE_URL:
      "postgresql://postgres:secret@db.project.supabase.co:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require",
    DIRECT_URL:
      "postgresql://postgres:secret@db.project.supabase.co:5432/postgres?sslmode=require",
  });

  assert.equal(env.DATABASE_URL?.includes("pgbouncer=true"), true);
  assert.equal(env.DIRECT_URL?.includes("sslmode=require"), true);
});

test("dev bypass stays opt-in in development and disabled in production", () => {
  const development = buildFeatureFlags(
    parseServerEnv({
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      ESTATEOS_ENABLE_DEV_BYPASS: "true",
    }),
  );
  const developmentDefault = buildFeatureFlags(
    parseServerEnv({
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    }),
  );
  const production = buildFeatureFlags(
    parseServerEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://estateos.example.com",
      ESTATEOS_ENABLE_DEV_BYPASS: "true",
    }),
  );

  assert.equal(development.allowDevBypass, true);
  assert.equal(developmentDefault.allowDevBypass, false);
  assert.equal(production.allowDevBypass, false);
});
