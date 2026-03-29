import test from "node:test";
import assert from "node:assert/strict";

import { fail, ok } from "@/lib/http";

test("ok returns a stable success envelope", async () => {
  const response = ok({ healthy: true }, { status: 201 });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.deepEqual(body, {
    success: true,
    data: { healthy: true },
  });
});

test("fail returns a safe error envelope", async () => {
  const response = fail("Something went wrong.", 503);
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.deepEqual(body, {
    success: false,
    error: "Something went wrong.",
  });
});
