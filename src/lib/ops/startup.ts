import { getProductionReadinessIssues } from "@/lib/config";
import { env, featureFlags } from "@/lib/env";
import { logInfo, logWarn } from "@/lib/ops/logger";

declare global {
  var estateOsStartupLogged: boolean | undefined;
}

export function logStartupReadinessOnce() {
  if (globalThis.estateOsStartupLogged) {
    return;
  }

  globalThis.estateOsStartupLogged = true;

  logInfo("EstateOS runtime initialized.", {
    environment: featureFlags.isProduction ? "production" : "development",
    hasDatabase: featureFlags.hasDatabase,
    hasClerk: featureFlags.hasClerk,
    hasPaystack: featureFlags.hasPaystack,
    hasR2: featureFlags.hasR2,
    hasRedis: featureFlags.hasRedis,
    hasResend: featureFlags.hasResend,
    hasInngest: featureFlags.hasInngest,
    hasSentry: featureFlags.hasSentry,
  });

  const readinessIssues = getProductionReadinessIssues(env);
  if (readinessIssues.length > 0) {
    logWarn("EstateOS runtime is missing production-critical configuration.", {
      issues: readinessIssues,
    });
  }

  if (!featureFlags.hasDatabase) {
    logWarn("EstateOS is running without DATABASE_URL. Database-backed features will fall back to demo mode where supported.");
  }
}
