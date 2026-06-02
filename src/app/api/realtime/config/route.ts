import { ok } from "@/lib/http";
import { env, featureFlags } from "@/lib/env";
import { resolveRealtimeRuntimeStatus } from "@/lib/realtime/config";

export function GET() {
  return ok(resolveRealtimeRuntimeStatus({
    configuredTransport: env.REALTIME_TRANSPORT,
    nodeEnv: env.NODE_ENV,
    redisConfigured: featureFlags.hasRedis,
  }));
}
