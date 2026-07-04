import test from "node:test";
import assert from "node:assert/strict";

import {
  assertProductionRuntimeEnv,
  buildClientFlags,
  buildFeatureFlags,
  getProductionReadinessIssues,
  getProductionReadinessWarnings,
  parsePublicEnv,
  parseRuntimeServerEnv,
  parseServerEnv,
  resolveAppBaseUrl,
  sanitizeDatabaseEndpointForReadiness,
} from "@/lib/config";

test("server env requires complete grouped service config for storage", () => {
  assert.throws(
    () =>
      parseServerEnv({
        NODE_ENV: "development",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        R2_ACCOUNT_ID: "account-only",
      }),
    /Cloudflare R2 configuration is incomplete/,
  );
});

test("runtime env disables incomplete Clerk and R2 groups instead of crashing public routes", () => {
  const env = parseRuntimeServerEnv({
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "https://estateos.example.com",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_example",
    R2_ACCOUNT_ID: "account-only",
  });
  const flags = buildFeatureFlags(env);
  const issues = getProductionReadinessIssues(env);

  assert.equal(flags.hasClerk, false);
  assert.equal(flags.hasR2, false);
  assert.equal(issues.some((issue) => issue.includes("clerk")), true);
  assert.equal(issues.some((issue) => issue.includes("r2")), true);
});

test("Clerk auth stays enabled without a webhook secret and readiness reports a warning", () => {
  const env = parseRuntimeServerEnv({
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "https://estateos.example.com",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_example",
    CLERK_SECRET_KEY: "sk_live_example",
  });
  const flags = buildFeatureFlags(env);
  const issues = getProductionReadinessIssues(env);
  const warnings = getProductionReadinessWarnings(env);

  assert.equal(flags.hasClerk, true);
  assert.equal(flags.hasClerkWebhook, false);
  assert.equal(issues.some((issue) => issue.includes("CLERK_WEBHOOK_SECRET")), false);
  assert.equal(warnings.some((warning) => warning.includes("CLERK_WEBHOOK_SECRET")), true);
});

test("partial Paystack config does not fail parse and disables Paystack features", () => {
  const env = parseServerEnv({
    NODE_ENV: "development",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    PAYSTACK_SECRET_KEY: "sk_test",
    PAYSTACK_PUBLIC_KEY: "pk_test",
  });

  const flags = buildFeatureFlags(env);

  assert.equal(flags.hasPaystack, false);
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

test("Linear requires api key and team id together", () => {
  assert.throws(
    () =>
      parseServerEnv({
        NODE_ENV: "development",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        LINEAR_API_KEY: "lin_api_test",
      }),
    /Linear configuration is incomplete/,
  );
});

test("feature flags only enable Linear when the full config is present", () => {
  const env = parseServerEnv({
    NODE_ENV: "development",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    LINEAR_API_KEY: "lin_api_test",
    LINEAR_TEAM_ID: "team_123",
  });

  const flags = buildFeatureFlags(env);

  assert.equal(flags.hasLinear, true);
});

test("PostHog requires public key and host together", () => {
  assert.throws(
    () =>
      parseServerEnv({
        NODE_ENV: "development",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
      }),
    /PostHog configuration should provide both public key and host together/,
  );
});

test("feature flags only enable PostHog when complete and not disabled", () => {
  const enabled = buildFeatureFlags(
    parseServerEnv({
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
      NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
    }),
  );
  const disabled = buildFeatureFlags(
    parseServerEnv({
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
      NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
      POSTHOG_DISABLED: "true",
    }),
  );

  assert.equal(enabled.hasPostHog, true);
  assert.equal(disabled.hasPostHog, false);
});

test("PostHog debug flag parses safely", () => {
  const env = parseServerEnv({
    NODE_ENV: "development",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    POSTHOG_DEBUG: "true",
  });
  const publicEnv = parsePublicEnv({
    NODE_ENV: "development",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    POSTHOG_DEBUG: "true",
  });

  assert.equal(env.POSTHOG_DEBUG, true);
  assert.equal(publicEnv.POSTHOG_DEBUG, true);
});

test("PostHog sample rates parse when valid", () => {
  const env = parseServerEnv({
    NODE_ENV: "development",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
    NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
    NEXT_PUBLIC_POSTHOG_CLIENT_EXCEPTION_SAMPLE_RATE: "0.5",
    POSTHOG_SERVER_EXCEPTION_SAMPLE_RATE: "0.75",
  });
  const publicEnv = parsePublicEnv({
    NODE_ENV: "development",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
    NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
    NEXT_PUBLIC_POSTHOG_CLIENT_EXCEPTION_SAMPLE_RATE: "0.5",
  });

  assert.equal(env.NEXT_PUBLIC_POSTHOG_CLIENT_EXCEPTION_SAMPLE_RATE, 0.5);
  assert.equal(env.POSTHOG_SERVER_EXCEPTION_SAMPLE_RATE, 0.75);
  assert.equal(publicEnv.NEXT_PUBLIC_POSTHOG_CLIENT_EXCEPTION_SAMPLE_RATE, 0.5);
});

test("PostHog sample rates reject invalid values", () => {
  assert.throws(
    () =>
      parseServerEnv({
        NODE_ENV: "development",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        NEXT_PUBLIC_POSTHOG_CLIENT_EXCEPTION_SAMPLE_RATE: "1.5",
      }),
    /Too big: expected number to be <=1|Number must be less than or equal to 1/,
  );
});

test("production env parse allows build-time config inspection", () => {
  const env = parseServerEnv({
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "https://estateos.example.com",
  });

  assert.equal(env.NODE_ENV, "production");
});

test("optional boolean env values parse Vercel 1/0 forms", () => {
  const vercelEnabled = parseServerEnv({
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "https://estateos.example.com",
    VERCEL: "1",
  });
  const vercelDisabled = parseServerEnv({
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "https://estateos.example.com",
    VERCEL: "0",
  });

  assert.equal(vercelEnabled.VERCEL, true);
  assert.equal(vercelDisabled.VERCEL, false);
});

test("production base url never falls back to localhost", () => {
  const env = parseServerEnv({
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    APP_BASE_URL: "http://localhost:3000",
    PORTAL_BASE_URL: "http://localhost:3000",
  });

  assert.equal(env.APP_BASE_URL, "https://estateos.tech");
  assert.equal(env.PORTAL_BASE_URL, "https://estateos.tech");
  assert.equal(env.APP_BASE_URL.includes("localhost"), false);
});

test("development base url may fall back to localhost", () => {
  assert.equal(
    resolveAppBaseUrl({
      nodeEnv: "development",
    }),
    "http://localhost:3000",
  );
});

test("Vercel production url fallback is normalized to https", () => {
  assert.equal(
    resolveAppBaseUrl({
      nodeEnv: "production",
      explicitUrls: ["http://localhost:3000"],
      vercelProjectProductionUrl: "estateos.tech",
      vercelUrl: "estateos-preview.vercel.app",
    }),
    "https://estateos.tech",
  );
});

test("production readiness warns when Clerk development keys are configured", () => {
  const env = parseServerEnv({
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "https://estateos.tech",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example",
    CLERK_SECRET_KEY: "sk_test_example",
  });
  const warnings = getProductionReadinessWarnings(env);

  assert.equal(warnings.some((warning) => warning.includes("publishable") || warning.includes("PUBLISHABLE")), true);
  assert.equal(warnings.some((warning) => warning.includes("CLERK_SECRET_KEY")), true);
});

test("production readiness warns when the superadmin allowlist is empty", () => {
  const env = parseServerEnv({
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "https://estateos.tech",
  });
  const warnings = getProductionReadinessWarnings(env);

  assert.equal(warnings.some((warning) => warning.includes("SUPERADMIN_EMAILS")), true);
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

test("client flags enable Clerk provider when the public publishable key exists", () => {
  const enabled = buildClientFlags(parsePublicEnv({
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "https://estateos.example.com",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_example",
  }));
  const disabled = buildClientFlags(parsePublicEnv({
    NODE_ENV: "development",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  }));

  assert.equal(enabled.hasClerk, true);
  assert.equal(disabled.hasClerk, false);
});

test("Mapbox browser maps can be enabled with only the public token", () => {
  const env = parseServerEnv({
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "https://estateos.example.com",
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: "pk.mapbox-public",
  });
  const flags = buildFeatureFlags(env);

  assert.equal(env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN, "pk.mapbox-public");
  assert.equal(env.MAPBOX_ACCESS_TOKEN, undefined);
  assert.equal(flags.hasMapbox, true);
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

test("production readiness reports unsafe Supabase runtime and migration url topology", () => {
  const env = parseServerEnv({
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "https://estateos.example.com",
    DATABASE_URL:
      "postgresql://postgres:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require",
    DIRECT_URL:
      "postgresql://postgres:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require",
  });

  const issues = getProductionReadinessIssues(env);

  assert.equal(issues.some((issue) => issue.includes("transaction pooler on port 6543")), true);
  assert.equal(issues.some((issue) => issue.includes("direct Supabase database endpoint")), true);
});

test("production readiness rejects a Paystack webhook url used as its signing secret", () => {
  const env = parseServerEnv({
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "https://estateos.example.com",
    PAYSTACK_WEBHOOK_SECRET: "https://estateos.example.com/api/webhooks/paystack",
  });

  assert.equal(
    getProductionReadinessIssues(env).some((issue) => issue.includes("signing secret")),
    true,
  );
});

test("database readiness endpoint sanitization never exposes credentials", () => {
  const pooled = sanitizeDatabaseEndpointForReadiness(
    "postgresql://postgres:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require",
  );
  const direct = sanitizeDatabaseEndpointForReadiness(
    "postgresql://postgres:secret@db.project.supabase.co:5432/postgres?sslmode=require",
  );

  assert.deepEqual(pooled, {
    configured: true,
    host: "aws-0-us-east-1.pooler.supabase.com",
    port: "6543",
    usesPooler: true,
    validUrl: true,
  });
  assert.deepEqual(direct, {
    configured: true,
    host: "db.project.supabase.co",
    port: "5432",
    usesPooler: false,
    validUrl: true,
  });
  assert.equal(JSON.stringify({ pooled, direct }).includes("secret"), false);
  assert.equal(JSON.stringify({ pooled, direct }).includes("postgres:"), false);
});

test("database readiness endpoint sanitization reports invalid urls safely", () => {
  const endpoint = sanitizeDatabaseEndpointForReadiness("not a database url");

  assert.deepEqual(endpoint, {
    configured: true,
    host: null,
    port: null,
    usesPooler: false,
    validUrl: false,
  });
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

test("dev access mode is local-only and disabled in production", () => {
  const development = buildFeatureFlags(
    parseServerEnv({
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      DEV_ACCESS_MODE: "true",
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
      DEV_ACCESS_MODE: "true",
    }),
  );

  assert.equal(development.devAccessMode, true);
  assert.equal(developmentDefault.devAccessMode, false);
  assert.equal(production.devAccessMode, false);
});

test("dev access mode never activates on Vercel", () => {
  const flags = buildFeatureFlags(
    parseServerEnv({
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      DEV_ACCESS_MODE: "true",
      VERCEL: "true",
    }),
  );

  assert.equal(flags.devAccessMode, false);
});

test("dev access mode is force-disabled when development points at production database", () => {
  const flags = buildFeatureFlags(
    parseServerEnv({
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      DEV_ACCESS_MODE: "true",
      PRODUCTION_DATABASE_HOST: "aws-0-eu-west-1.pooler.supabase.com",
      PRODUCTION_DATABASE_PROJECT_REF: "epxbejutuodmnsdfvcjr",
      DATABASE_URL:
        "postgresql://postgres:secret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require",
    }),
  );

  assert.equal(flags.devAccessMode, false);
});

test("dev bypass is force-disabled when development points at the production database", () => {
  const flags = buildFeatureFlags(
    parseServerEnv({
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      ESTATEOS_ENABLE_DEV_BYPASS: "true",
      PRODUCTION_DATABASE_HOST: "aws-0-eu-west-1.pooler.supabase.com",
      PRODUCTION_DATABASE_PROJECT_REF: "epxbejutuodmnsdfvcjr",
      DATABASE_URL:
        "postgresql://postgres:secret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require",
    }),
  );

  assert.equal(flags.allowDevBypass, false);
});

test("dev bypass stays available when development points at a separate local database", () => {
  const flags = buildFeatureFlags(
    parseServerEnv({
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      ESTATEOS_ENABLE_DEV_BYPASS: "true",
      PRODUCTION_DATABASE_HOST: "aws-0-eu-west-1.pooler.supabase.com",
      PRODUCTION_DATABASE_PROJECT_REF: "epxbejutuodmnsdfvcjr",
      DATABASE_URL:
        "postgresql://postgres:postgres@localhost:5432/realestate_platform?schema=public",
    }),
  );

  assert.equal(flags.allowDevBypass, true);
});
