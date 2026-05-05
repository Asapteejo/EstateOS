import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

import { fail, ok, validationFail } from "@/lib/http";

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

test("validationFail returns safe issue details", async () => {
  const parsed = z.object({
    title: z.string().min(3),
    location: z.object({
      city: z.string().min(2),
    }),
  }).safeParse({ title: "", location: { city: "" } });
  assert.equal(parsed.success, false);

  const response = validationFail(parsed.error);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.error, "Validation failed");
  assert.deepEqual(body.issues, [
    {
      path: "title",
      message: "Too small: expected string to have >=3 characters",
      code: "too_small",
    },
    {
      path: "location.city",
      message: "Too small: expected string to have >=2 characters",
      code: "too_small",
    },
  ]);
});

test("validationFail renders unknown key paths by field name", async () => {
  const parsed = z.object({ title: z.string() }).strict().safeParse({
    title: "Admiralty Crest",
    companyId: "caller-company",
  });
  assert.equal(parsed.success, false);

  const response = validationFail(parsed.error);
  const body = await response.json();

  assert.equal(body.issues[0].path, "companyId");
  assert.equal(body.issues[0].code, "unrecognized_keys");
});
