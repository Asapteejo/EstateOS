import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("SSE errors fall back to polling without refreshing the router", () => {
  const source = readFileSync(
    "src/components/realtime/live-surface-sync.tsx",
    "utf8",
  );
  const errorHandler = source.match(/source\.onerror = \(\) => \{([\s\S]*?)\n        \};/);

  assert.ok(errorHandler);
  assert.match(errorHandler[1], /startPolling\(\)/);
  assert.doesNotMatch(errorHandler[1], /refresh\(\)/);
});
