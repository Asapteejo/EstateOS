import test from "node:test";
import assert from "node:assert/strict";

import { resolveRealtimeRuntimeStatus } from "@/lib/realtime/config";

test("realtime defaults to polling without claiming a redis backplane", () => {
  assert.deepEqual(
    resolveRealtimeRuntimeStatus({
      nodeEnv: "production",
      redisConfigured: true,
    }),
    {
      redisConfigured: true,
      requestedTransport: "polling",
      realtimeTransport: "polling",
      realtimeBackplane: "polling",
    },
  );
});

test("auto transport stays on polling in production", () => {
  assert.equal(
    resolveRealtimeRuntimeStatus({
      configuredTransport: "auto",
      nodeEnv: "production",
      redisConfigured: true,
    }).realtimeTransport,
    "polling",
  );
});

test("explicit sse reports the in-process event backplane", () => {
  assert.equal(
    resolveRealtimeRuntimeStatus({
      configuredTransport: "sse",
      nodeEnv: "production",
      redisConfigured: true,
    }).realtimeBackplane,
    "process",
  );
});
