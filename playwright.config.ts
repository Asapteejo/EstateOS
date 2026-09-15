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
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
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
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
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
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
