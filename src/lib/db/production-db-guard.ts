// The production Supabase project ref and pooler host are intentionally NOT
// hardcoded here. They are sourced from PRODUCTION_DATABASE_PROJECT_REF /
// PRODUCTION_DATABASE_HOST (see .env.local for local development and the
// platform environment for deploys). This keeps the production database
// identifier out of source control. When neither is configured the guard
// cannot identify a production database and treats the connection as safe.
type ProductionDatabaseGuardEnv = {
  NODE_ENV?: string;
  DATABASE_URL?: string;
  DIRECT_URL?: string;
  PRODUCTION_DATABASE_PROJECT_REF?: string;
  PRODUCTION_DATABASE_HOST?: string;
  ALLOW_PRODUCTION_DB_WRITES?: string | boolean;
};

function normalize(value: string | boolean | undefined) {
  return typeof value === "boolean" ? String(value) : value?.trim().toLowerCase() ?? "";
}

function getDatabaseHost(value: string | undefined) {
  if (!value) return "";
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isKnownProductionDatabase(input: ProductionDatabaseGuardEnv) {
  const projectRef = normalize(input.PRODUCTION_DATABASE_PROJECT_REF);
  const productionHost = normalize(input.PRODUCTION_DATABASE_HOST);

  // Without a configured production identifier we cannot tell whether the
  // connection points at production, so we fail open (treat as not-production).
  if (!projectRef && !productionHost) {
    return false;
  }

  const urls = [input.DATABASE_URL, input.DIRECT_URL].filter(Boolean) as string[];

  return urls.some((url) => {
    const host = getDatabaseHost(url);
    if (productionHost && host === productionHost) {
      return true;
    }
    if (projectRef && host.includes(projectRef)) {
      return true;
    }
    return false;
  });
}

export function getProductionDatabaseSafetyStatus(
  input: ProductionDatabaseGuardEnv = process.env,
) {
  const isProductionRuntime = input.NODE_ENV === "production";
  const pointsToProductionDatabase = isKnownProductionDatabase(input);
  const explicitWriteOverride = normalize(input.ALLOW_PRODUCTION_DB_WRITES) === "true";

  return {
    isProductionRuntime,
    pointsToProductionDatabase,
    sharedDatabaseRisk: !isProductionRuntime && pointsToProductionDatabase,
    explicitWriteOverride,
  };
}

export function assertProductionDatabaseWriteAllowed(input: {
  operation: string;
  destructive?: boolean;
  allowExplicitOverride?: boolean;
  env?: ProductionDatabaseGuardEnv;
}) {
  const status = getProductionDatabaseSafetyStatus(input.env);
  if (!status.sharedDatabaseRisk) return status;

  const prefix = `[ESTATEOS PRODUCTION DB GUARD] ${input.operation}`;
  if (input.destructive) {
    throw new Error(`${prefix} is blocked permanently because the configured database is production.`);
  }

  if (input.allowExplicitOverride && status.explicitWriteOverride) {
    console.warn(`${prefix}: WARNING - explicit production database write override is enabled.`);
    return status;
  }

  throw new Error(
    `${prefix} is blocked because local development is pointing at the production database.`,
  );
}
