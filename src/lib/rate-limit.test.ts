import test from "node:test";
import assert from "node:assert/strict";

import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

type FakeLimiter = Parameters<typeof enforceRateLimit>[0];

function makeRequest(headers: Record<string, string>): Request {
  return new Request("https://example.com/api/test", { headers });
}

test("getClientIp prefers the left-most x-forwarded-for entry", () => {
  const request = makeRequest({
    "x-forwarded-for": "203.0.113.5, 70.41.3.18, 150.172.238.178",
  });
  assert.equal(getClientIp(request), "203.0.113.5");
});

test("getClientIp falls back to x-real-ip then a local default", () => {
  assert.equal(getClientIp(makeRequest({ "x-real-ip": "198.51.100.7" })), "198.51.100.7");
  assert.equal(getClientIp(makeRequest({})), "local");
});

test("enforceRateLimit is a no-op (fail-open) when no limiter is configured", async () => {
  const result = await enforceRateLimit(null, ["ip:1.2.3.4", "user:abc"]);
  assert.equal(result, null);
});

test("enforceRateLimit allows the request when every identifier is under limit", async () => {
  const calls: string[] = [];
  const limiter = {
    limit: async (id: string) => {
      calls.push(id);
      return { success: true, reset: Date.now() + 60_000 };
    },
  } as unknown as FakeLimiter;

  const result = await enforceRateLimit(limiter, ["ip:1.2.3.4", "user:abc"]);
  assert.equal(result, null);
  assert.deepEqual(calls, ["ip:1.2.3.4", "user:abc"]);
});

test("enforceRateLimit returns a 429 with Retry-After when an identifier is over limit", async () => {
  const limiter = {
    limit: async () => ({ success: false, reset: Date.now() + 30_000 }),
  } as unknown as FakeLimiter;

  const result = await enforceRateLimit(limiter, ["ip:1.2.3.4"], "Slow down.");
  assert.ok(result, "expected a response to be returned");
  assert.equal(result!.status, 429);
  const retryAfter = Number(result!.headers.get("Retry-After"));
  assert.ok(retryAfter > 0 && retryAfter <= 30, `unexpected Retry-After: ${retryAfter}`);
  const payload = (await result!.json()) as { success: boolean; error: string };
  assert.equal(payload.success, false);
  assert.equal(payload.error, "Slow down.");
});

test("enforceRateLimit stops at the first identifier that is over limit", async () => {
  const calls: string[] = [];
  const limiter = {
    limit: async (id: string) => {
      calls.push(id);
      return { success: false, reset: Date.now() + 10_000 };
    },
  } as unknown as FakeLimiter;

  await enforceRateLimit(limiter, ["ip:over", "user:never-checked"]);
  assert.deepEqual(calls, ["ip:over"], "should short-circuit on the first failing id");
});
