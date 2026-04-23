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

export const inspectionRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(8, "10 m"),
      analytics: true,
      prefix: "ratelimit:inspection",
    })
  : null;

export const supportRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "15 m"),
      analytics: true,
      prefix: "ratelimit:support",
    })
  : null;
