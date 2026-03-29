import { Redis } from "@upstash/redis";

import { env, featureFlags } from "@/lib/env";

export const redis = featureFlags.hasRedis
  ? new Redis({
      url: env.UPSTASH_REDIS_REST_URL!,
      token: env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;
