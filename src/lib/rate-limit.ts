import { Ratelimit } from "@upstash/ratelimit";

import { redis } from "@/lib/cache/redis";

export const inquiryRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "10 m"),
      analytics: true,
      prefix: "ratelimit:inquiry",
    })
  : null;
