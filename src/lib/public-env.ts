import { buildClientFlags, parsePublicEnv } from "@/lib/config";

export const publicEnv = parsePublicEnv(process.env);
export const clientFlags = buildClientFlags(publicEnv);
