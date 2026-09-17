import { expect, test } from "@playwright/test";

/**
 * Deployment health gates.
 *
 * The first test here is the one that matters most: it is the check that would
 * have caught the production incident where the database was 14 migrations
 * behind the deployed code and every page touching the new columns threw
 * Prisma P2022 ("column does not exist").
 *
 * Run this against a deployment immediately after release:
 *   E2E_BASE_URL=https://estateos.tech npx playwright test e2e/health.spec.ts
 */

test("database has every migration the deployed code expects", async ({ request }) => {
  const response = await request.get("/api/readyz");

  expect(
    response.status(),
    "readyz must return 200; a 503 means the deployment is not serviceable",
  ).toBe(200);

  const body = await response.json();

  // The explicit assertion: no migration in the repo may be missing from the
  // live database. `missing` is surfaced so a failure names the exact gap.
  expect(
    body?.checks?.database?.migrations?.missing ?? [],
    "Database is behind the deployed code. Run `npm run db:migrate:deploy` before serving traffic.",
  ).toEqual([]);

  expect(body?.checks?.database?.migrations?.ok).toBe(true);
  expect(body?.ok).toBe(true);
});

test("liveness endpoint responds", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
});

test("readyz never leaks credentials", async ({ request }) => {
  const response = await request.get("/api/readyz");
  const raw = await response.text();

  // Host names are fine; secrets are not.
  for (const secretish of ["password", "secret", "sk_live", "sk_test", "Bearer "]) {
    expect(raw.toLowerCase()).not.toContain(secretish.toLowerCase());
  }
});
