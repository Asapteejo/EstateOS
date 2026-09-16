import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end smoke configuration.
 *
 * Purpose: catch the class of failure that reached production as a P2022
 * "column does not exist" 500 — a page that renders fine in the developer's
 * head but throws when actually loaded. Unit tests and typecheck cannot see
 * this; only loading every route in a real browser can.
 *
 * Runs against a local dev server by default. Point at a deployed environment
 * with E2E_BASE_URL (then the local server is not started):
 *   E2E_BASE_URL=https://staging.example.com npm run e2e
 */
/**
 * Public pages resolve their tenant from the HOST, and for marketing routes a
 * DEFAULT_COMPANY_SLUG fallback is deliberately NOT applied — only a tenant
 * host counts. On 127.0.0.1 every tenant page therefore renders the platform
 * site or 404s. `<slug>.localhost` is the supported dev tenant host (see
 * resolveTenantSubdomainFromHost), and Chromium resolves *.localhost to
 * loopback itself, so the suite drives the seeded demo tenant by default.
 */
const localTenantHost = `http://${process.env.E2E_TENANT_SLUG ?? "acme-realty"}.localhost:3000`;
const baseURL = process.env.E2E_BASE_URL ?? localTenantHost;
const usingExternalTarget = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: "./e2e",
  // Route sweeps are I/O bound; a little parallelism keeps the suite quick
  // without overwhelming a single dev server.
  workers: process.env.CI ? 2 : 4,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  // The suite runs against `next dev`, which compiles each route on its first
  // request — 30s+ per admin route on a cold, slow machine. 60s was tight
  // enough that the first visit to a route timed out and took the rest of the
  // file's navigations down with it (net::ERR_ABORTED on teardown).
  timeout: 120_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    // Windows (and some Linux setups) do not resolve *.localhost, so the
    // tenant host is mapped to loopback in the browser itself rather than
    // relying on the OS resolver. Harmless against an external target.
    launchOptions: usingExternalTarget
      ? undefined
      : { args: ["--host-resolver-rules=MAP *.localhost 127.0.0.1"] },
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Buyers are mobile-first; the portal must survive a phone viewport too.
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /smoke\.spec\.ts/ },
  ],

  webServer: usingExternalTarget
    ? undefined
    : {
        command: "npm run dev",
        // Node (unlike Chromium) does not resolve *.localhost on every
        // platform, so the readiness probe uses loopback directly.
        url: "http://127.0.0.1:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
