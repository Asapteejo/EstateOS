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

test("footer navigation links stack instead of running together", async ({ page }) => {
  await page.goto("/");

  // Regression: the links were given `inline-flex` for a 44px tap target while
  // their container still relied on `space-y-*` (a margin between BLOCK boxes).
  // Inline-level boxes flow onto one line, so the footer rendered
  // "ListingsBuyer PortalAdmin Dashboard". Each link must start its own line.
  // Compared per column: separate footer columns sit side by side on desktop,
  // so links in different columns share a line legitimately.
  const result = await page.evaluate(() => {
    const groups = new Map<Element, Array<{ text: string; top: number; left: number; height: number }>>();
    for (const link of document.querySelectorAll("footer a")) {
      const parent = link.parentElement;
      if (!parent) continue;
      const rect = link.getBoundingClientRect();
      if (rect.width === 0) continue;
      const entry = {
        text: (link.textContent || "").trim(),
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        height: Math.round(rect.height),
      };
      groups.set(parent, [...(groups.get(parent) ?? []), entry]);
    }

    const collisions: string[] = [];
    let linkCount = 0;
    let shortest = Infinity;
    for (const entries of groups.values()) {
      if (entries.length < 2) continue;
      linkCount += entries.length;
      for (const entry of entries) {
        shortest = Math.min(shortest, entry.height);
        const sibling = entries.find(
          (other) => other !== entry && Math.abs(other.top - entry.top) < 4,
        );
        if (sibling) collisions.push(`${entry.text} + ${sibling.text}`);
      }
    }
    return { collisions: [...new Set(collisions)], linkCount, shortest };
  });

  expect(result.linkCount, "expected grouped footer navigation links").toBeGreaterThan(2);
  expect(
    result.collisions,
    "footer links in the same column share a line — inline-level boxes in a non-flex container again",
  ).toEqual([]);

  // The 44px tap target applies on phones only: above `sm` the links
  // deliberately return to desktop density (sm:min-h-0).
  const viewportWidth = page.viewportSize()?.width ?? 0;
  if (viewportWidth < 640) {
    expect(result.shortest, "footer link lost its 44px touch target on mobile").toBeGreaterThanOrEqual(44);
  }
});

test("tenant site content renders copy rather than blank sections", async ({ page }) => {
  await page.goto("/");

  // If the CMS read silently failed, the hero would collapse to empty text.
  const heading = page.locator("h1").first();
  await expect(heading).toBeVisible();
  expect((await heading.innerText()).trim().length).toBeGreaterThan(10);
});
