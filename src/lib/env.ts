import { buildFeatureFlags, parseRuntimeServerEnv } from "@/lib/config";
import { logError } from "@/lib/ops/logger";

function loadRuntimeEnv() {
  try {
    return parseRuntimeServerEnv(process.env);
  } catch (error) {
    logError("EstateOS runtime environment parsing failed.", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    throw error;
  }
}

export const env = loadRuntimeEnv();
export const featureFlags = buildFeatureFlags(env);
