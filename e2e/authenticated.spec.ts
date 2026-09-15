import { expect, test, type Page } from "@playwright/test";

/**
 * Authenticated route sweep (operator + buyer surfaces).
 *
 * Uses the dev-bypass session endpoint so the suite needs no Clerk
 * credentials. That endpoint only mints a session when
 * ESTATEOS_ENABLE_DEV_BYPASS is on AND the database is not the production
 * one, so these tests are inert against production and skip themselves.
 *
 * This sweep is what would have caught the reported incident directly:
 * /admin/settings/site-content threw P2022 because the database was missing
 * migration 0042, and no unit test loads that page.
 */

const ADMIN_ROUTES = [
  "/admin",
  "/admin/overview",
  "/admin/listings",
  "/admin/leads",
  "/admin/clients",
  "/admin/pipeline",
  "/admin/transactions",
  "/admin/payments",
  "/admin/invoices",
  "/admin/contracts",
  "/admin/documents",
  "/admin/team",
  "/admin/users",
  "/admin/analytics",
  "/admin/messages",
  "/admin/announcements",
  "/admin/testimonials",
  "/admin/audit-logs",
  "/admin/settings",
  "/admin/settings/site-content",
  "/admin/settings/branding",
] as const;

const PORTAL_ROUTES = [
  "/portal",
  "/portal/profile",
  "/portal/saved",
  "/portal/inspections",
  "/portal/reservations",
  "/portal/messages",
  "/portal/payments",
  "/portal/invoices",
  "/portal/timeline",
  "/portal/contracts",
  "/portal/notifications",
  "/portal/documents",
  "/portal/support",
] as const;

const IGNORABLE_CONSOLE = [
  /favicon/i,
  /googletagmanager|posthog|sentry|clerk-telemetry/i,
  /ERR_BLOCKED_BY_CLIENT/i,
  /Download the React DevTools/i,
];

function watchForErrors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (IGNORABLE_CONSOLE.some((pattern) => pattern.test(text))) return;
    consoleErrors.push(text);
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  return { consoleErrors, pageErrors };
}

/**
 * Establishes a dev session. Returns false when dev bypass is unavailable
 * (production, or the flag is off), so the caller can skip rather than fail.
 */
async function signInAs(page: Page, role: "admin" | "buyer"): Promise<boolean> {
  const landing = role === "admin" ? "/admin" : "/portal";
  await page.goto(`/api/dev/session?role=${role}&redirectTo=${encodeURIComponent(landing)}`);

  // Dev bypass off → the endpoint clears cookies and we land unauthenticated.
  const url = page.url();
  return url.includes(landing) && !url.includes("/sign-in") && !url.includes("/auth/");
}

async function assertRouteHealthy(page: Page, route: string) {
  const { consoleErrors, pageErrors } = watchForErrors(page);
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });

  expect(
    response?.status() ?? 0,
    `${route} returned a server error — this is the signature of a missing migration or a broken query.`,
  ).toBeLessThan(500);

  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body, `${route} rendered a server-side exception`).not.toContain(
    "a server-side exception has occurred",
  );
  expect(body, `${route} rendered an application error`).not.toContain("application error");

  expect(pageErrors, `${route} threw in the browser`).toEqual([]);
  expect(consoleErrors, `${route} logged console errors`).toEqual([]);
}

test.describe("operator surfaces", () => {
  test.beforeEach(async ({ page }) => {
    const signedIn = await signInAs(page, "admin");
    test.skip(!signedIn, "Dev bypass unavailable (production or flag off) — skipping.");
  });

  for (const route of ADMIN_ROUTES) {
    test(`admin route renders: ${route}`, async ({ page }) => {
      await assertRouteHealthy(page, route);
    });
  }

  test("site content editor loads its form, not a failure banner", async ({ page }) => {
    await page.goto("/admin/settings/site-content");

    const body = await page.locator("body").innerText();

    // When the database is behind the code the editor degrades to a banner
    // instead of throwing. That is correct behavior, but in a healthy
    // environment it means migrations are pending and must be applied.
    expect(
      body,
      "Site content editor is in its degraded state — the database is missing migrations. Run `npm run db:migrate:deploy`.",
    ).not.toContain("Site content unavailable");

    await expect(page.getByText("Search & SEO")).toBeVisible();
  });
});

test.describe("buyer portal", () => {
  test.beforeEach(async ({ page }) => {
    const signedIn = await signInAs(page, "buyer");
    test.skip(!signedIn, "Dev bypass unavailable (production or flag off) — skipping.");
  });

  for (const route of PORTAL_ROUTES) {
    test(`portal route renders: ${route}`, async ({ page }) => {
      await assertRouteHealthy(page, route);
    });
  }
});
