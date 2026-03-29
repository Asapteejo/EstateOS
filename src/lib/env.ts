import { buildFeatureFlags, parseServerEnv } from "@/lib/config";

export const env = parseServerEnv(process.env);
export const featureFlags = buildFeatureFlags(env);
