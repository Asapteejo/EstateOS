import { prisma } from "@/lib/db/prisma";
import { env, featureFlags } from "@/lib/env";
import {
  getProductionReadinessIssues,
  getProductionReadinessWarnings,
  sanitizeDatabaseEndpointForReadiness,
} from "@/lib/config";
import { buildSafeErrorLogContext, logError } from "@/lib/ops/logger";
import { parseSuperadminEmails } from "@/lib/auth/superadmin";
import { getProductionDatabaseSafetyStatus } from "@/lib/db/production-db-guard";
import { resolveRealtimeRuntimeStatus } from "@/lib/realtime/config";

export const EXPECTED_PRODUCTION_MIGRATIONS = [
  "0030_communication_wallet_ledger",
  "0031_communication_topups",
  "0032_buyer_portal_kyc_review_metadata",
  "0033_buyer_testimonial_moderation",
  "0034_contract_generation_mvp",
  "0035_contract_template_version_locking",
] as const;

export function getMissingExpectedMigrations(appliedMigrations: string[]) {
  const applied = new Set(appliedMigrations);
  return EXPECTED_PRODUCTION_MIGRATIONS.filter((migration) => !applied.has(migration));
}

export function buildHealthSnapshot() {
  return {
    ok: true,
    service: "EstateOS",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    version: "0.1.0",
  };
}

export function buildDependencySummary() {
  const databaseSafety = getProductionDatabaseSafetyStatus(env);
  const realtime = resolveRealtimeRuntimeStatus({
    configuredTransport: env.REALTIME_TRANSPORT,
    nodeEnv: env.NODE_ENV,
    redisConfigured: featureFlags.hasRedis,
  });
  return {
    database: featureFlags.hasDatabase ? "configured" : "disabled",
    clerk: featureFlags.hasClerk ? "configured" : "demo-or-disabled",
    clerkWebhook: featureFlags.hasClerkWebhook ? "configured" : "disabled",
    paystack: featureFlags.hasPaystack ? "configured" : "demo-or-disabled",
    r2: featureFlags.hasR2 ? "configured" : "demo-or-disabled",
    vercelDomains: featureFlags.hasVercelDomains ? "configured" : "manual-setup",
    resend: featureFlags.hasResend ? "configured" : "disabled",
    redis: featureFlags.hasRedis ? "configured" : "disabled",
    redisConfigured: realtime.redisConfigured,
    realtimeTransport: realtime.realtimeTransport,
    realtimeBackplane: realtime.realtimeBackplane,
    inngest: featureFlags.hasInngest ? "configured" : "disabled",
    sentry: featureFlags.hasSentry ? "configured" : "disabled",
    superadminAllowlist: {
      configured: Boolean(env.SUPERADMIN_EMAILS),
      count: parseSuperadminEmails(env.SUPERADMIN_EMAILS).size,
    },
    productionDatabaseSafety: {
      sharedDatabaseRisk: databaseSafety.sharedDatabaseRisk,
      localWritesBlocked: databaseSafety.sharedDatabaseRisk && !databaseSafety.explicitWriteOverride,
    },
  };
}

export function buildRuntimeReadinessSummary() {
  const issues = getProductionReadinessIssues(env);
  const warnings = getProductionReadinessWarnings(env);

  return {
    ok: issues.length === 0,
    issues,
    warnings,
  };
}

export function buildDatabaseReadinessMetadata() {
  return {
    runtime: sanitizeDatabaseEndpointForReadiness(env.DATABASE_URL),
    direct: sanitizeDatabaseEndpointForReadiness(env.DIRECT_URL),
  };
}

export async function checkDatabaseReadiness(input?: { route?: string }) {
  if (!featureFlags.hasDatabase) {
    return {
      configured: false,
      ok: true,
      endpoints: buildDatabaseReadinessMetadata(),
      migrations: {
        ok: false,
        missing: [...EXPECTED_PRODUCTION_MIGRATIONS],
      },
    };
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    const appliedMigrations = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL
        AND rolled_back_at IS NULL
    `;
    const missingMigrations = getMissingExpectedMigrations(
      appliedMigrations.map((migration) => migration.migration_name),
    );

    return {
      configured: true,
      ok: missingMigrations.length === 0,
      endpoints: buildDatabaseReadinessMetadata(),
      migrations: {
        ok: missingMigrations.length === 0,
        missing: missingMigrations,
      },
    };
  } catch (error) {
    logError("Database readiness check failed.", {
      route: input?.route ?? "/api/readyz",
      ...buildSafeErrorLogContext(error),
    });

    return {
      configured: true,
      ok: false,
      endpoints: buildDatabaseReadinessMetadata(),
      migrations: {
        ok: false,
        missing: [...EXPECTED_PRODUCTION_MIGRATIONS],
      },
    };
  }
}
