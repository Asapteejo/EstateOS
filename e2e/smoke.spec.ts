import { expect, test, type Page } from "@playwright/test";

/**
 * Public route smoke sweep.
 *
 * Loads every public page in a real browser and fails on anything that a
 * typecheck cannot see: a 5xx response, a Next.js error boundary, or a
 * server-side exception surfaced in the console. This is the net that catches
 * runtime-only faults such as Prisma P2022 ("column does not exist") when the
 * database is behind the deployed code.
 */

const PUBLIC_ROUTES = [
  "/",
  "/properties",
  "/about",
  "/team",
  "/agents",
  "/contact",
  "/faq",
  "/blog",
  "/testimonials",
  "/careers",
] as const;

/** Text Next.js renders when a server component throws. */
const ERROR_BOUNDARY_MARKERS = [
  "Application error",
  "a server-side exception has occurred",
  "This page could not be found", // only unexpected on routes we expect to exist
  "Internal Server Error",
];

/**
 * Console noise that is not a defect: third-party embeds, favicon 404s, and
 * analytics blocked by the test browser.
 */
const IGNORABLE_CONSOLE = [
  /favicon/i,
  /googletagmanager|posthog|sentry|clerk-telemetry/i,
  /ERR_BLOCKED_BY_CLIENT/i,
  /Download the React DevTools/i,
  // Dev-server noise: the suite runs against `next dev`, whose hot-reload
  // socket logs a console error in headless CI. Not an application fault.
  /webpack-hmr|hot-update|__nextjs|turbopack-hmr/i,
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

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  return { consoleErrors, pageErrors };
}

for (const route of PUBLIC_ROUTES) {
  test(`public route renders without server error: ${route}`, async ({ page }) => {
    const { consoleErrors, pageErrors } = watchForErrors(page);

    const response = await page.goto(route, { waitUntil: "domcontentloaded" });

    // A 5xx is the exact signature of the production incident.
    expect(
      response?.status() ?? 0,
      `${route} returned a server error — check the server logs for the underlying exception.`,
    ).toBeLessThan(500);

    const body = (await page.locator("body").innerText()).toLowerCase();
    for (const marker of ERROR_BOUNDARY_MARKERS) {
      expect(body, `${route} rendered an error boundary ("${marker}")`).not.toContain(
        marker.toLowerCase(),
      );
    }

    expect(pageErrors, `${route} threw in the browser`).toEqual([]);
    expect(consoleErrors, `${route} logged console errors`).toEqual([]);
  });
}

test("homepage shows the property search and a working listings link", async ({ page }) => {
  await page.goto("/");

  // The hero search is the front door of the site; it must submit to /properties.
  const search = page.locator('form[action="/properties"]').first();
  await expect(search).toBeVisible();

  await search.locator('input[name="location"]').fill("Lekki");
  await Promise.all([page.waitForURL(/\/properties/), search.locator("button[type=submit]").click()]);

  expect(page.url()).toContain("location=Lekki");
});

test("tenant site content renders copy rather than blank sections", async ({ page }) => {
  await page.goto("/");

  // If the CMS read silently failed, the hero would collapse to empty text.
  const heading = page.locator("h1").first();
  await expect(heading).toBeVisible();
  expect((await heading.innerText()).trim().length).toBeGreaterThan(10);
});
