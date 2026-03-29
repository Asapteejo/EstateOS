import { prisma } from "@/lib/db/prisma";
import { env, featureFlags } from "@/lib/env";
import { getProductionReadinessIssues } from "@/lib/config";

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
  return {
    database: featureFlags.hasDatabase ? "configured" : "disabled",
    clerk: featureFlags.hasClerk ? "configured" : "demo-or-disabled",
    paystack: featureFlags.hasPaystack ? "configured" : "demo-or-disabled",
    r2: featureFlags.hasR2 ? "configured" : "demo-or-disabled",
    resend: featureFlags.hasResend ? "configured" : "disabled",
    redis: featureFlags.hasRedis ? "configured" : "disabled",
    inngest: featureFlags.hasInngest ? "configured" : "disabled",
    sentry: featureFlags.hasSentry ? "configured" : "disabled",
  };
}

export function buildRuntimeReadinessSummary() {
  const issues = getProductionReadinessIssues(env);

  return {
    ok: issues.length === 0,
    issues,
  };
}

export async function checkDatabaseReadiness() {
  if (!featureFlags.hasDatabase) {
    return {
      configured: false,
      ok: true,
    };
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      configured: true,
      ok: true,
    };
  } catch {
    return {
      configured: true,
      ok: false,
    };
  }
}
