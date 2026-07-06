import { redis } from "@/lib/cache/redis";
import { buildSafeErrorLogContext, logWarn } from "@/lib/ops/logger";

/**
 * Cross-instance change counters — the backplane for CONDITIONAL polling.
 *
 * Every published realtime event bumps a per-company counter (and the
 * platform counter for the superadmin surface) in Upstash Redis. Dashboards
 * poll the tiny /api/realtime/version endpoint (one Redis GET) and call
 * router.refresh() ONLY when the counter moved — instead of blindly
 * re-rendering every 30s. Correct across serverless instances by
 * construction, unlike the in-process EventEmitter bus.
 *
 * Degrades gracefully: without Redis, isChangeCounterEnabled() is false and
 * clients fall back to the old blind-interval polling.
 */

const PLATFORM_VERSION_KEY = "realtime:version:platform";

export function companyVersionKey(companyId: string) {
  return `realtime:version:company:${companyId}`;
}

export function isChangeCounterEnabled() {
  return Boolean(redis);
}

/**
 * Fire-and-forget bump. Company events increment both the company counter and
 * the platform counter (the superadmin surface watches everything); platform
 * events increment only the platform counter.
 */
export async function bumpChangeCounters(companyId?: string | null) {
  if (!redis) {
    return;
  }

  try {
    const pipeline = redis.pipeline();
    pipeline.incr(PLATFORM_VERSION_KEY);
    if (companyId) {
      pipeline.incr(companyVersionKey(companyId));
    }
    await pipeline.exec();
  } catch (error) {
    // Never let a counter bump break the mutation that published the event.
    logWarn("Realtime change-counter bump failed; polling falls back to blind refresh.", {
      ...buildSafeErrorLogContext(error),
    });
  }
}

/** Current version for a surface. Null when Redis is unavailable or on error. */
export async function readChangeVersion(input: {
  scope: "platform" | "company";
  companyId?: string | null;
}): Promise<number | null> {
  if (!redis) {
    return null;
  }

  try {
    const key =
      input.scope === "company" && input.companyId
        ? companyVersionKey(input.companyId)
        : PLATFORM_VERSION_KEY;
    const value = await redis.get<number>(key);
    return typeof value === "number" ? value : value ? Number(value) : 0;
  } catch (error) {
    logWarn("Realtime change-counter read failed.", {
      ...buildSafeErrorLogContext(error),
    });
    return null;
  }
}
