import { expect, test } from "@playwright/test";

/**
 * Regression: /admin/users → "Add person" always submitted STAFF ("Front Desk").
 *
 * The Role <select> is controlled, and its onChange deferred setSelectedRole
 * into a setTimeout that read e.target.value lazily. React restores a
 * controlled select to its current state right after the event, so by the time
 * the timeout ran the DOM value was back to STAFF and that is what got saved.
 *
 * The server action is intercepted rather than executed so the test proves the
 * submitted payload without creating a real Clerk account or sending an invite.
 */

test("Add person submits the role that was selected", async ({ page }) => {
  await page.goto(`/api/dev/session?role=admin&redirectTo=${encodeURIComponent("/admin/users")}`);
  const url = page.url();
  test.skip(
    !url.includes("/admin") || url.includes("/sign-in") || url.includes("/auth/"),
    "Dev bypass unavailable (production or flag off) — skipping.",
  );

  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Add person" }).click();

  const roleSelect = page.locator("#person-role");
  await expect(roleSelect).toHaveValue("STAFF");
  await roleSelect.selectOption("FINANCE");

  // Give a deferred (buggy) update every chance to run and revert before asserting.
  await page.waitForTimeout(250);
  await expect(roleSelect).toHaveValue("FINANCE");

  await page.locator("#person-firstName").fill("E2E");
  await page.locator("#person-lastName").fill("Finance");
  await page.locator("#person-email").fill(`e2e-finance-${Date.now()}@example.test`);

  // Any POST to this route carries the form. A hydrated page sends a server
  // action (Next-Action header, multipart body); before hydration the same
  // form posts natively (url-encoded), so both shapes are accepted — the point
  // is what `role` the form submitted, not which transport carried it.
  let submittedBody: string | null = null;
  await page.route("**/admin/users**", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      submittedBody = request.postData();
      await route.abort();
      return;
    }
    await route.continue();
  });

  const actionRequest = page.waitForRequest((request) => request.method() === "POST");
  await page.getByRole("button", { name: "Create account" }).click();
  await actionRequest;

  expect(submittedBody, "form submission was not captured").not.toBeNull();
  const body = submittedBody ?? "";
  // Multipart (server action, field optionally prefixed e.g. "1_role") or
  // url-encoded (pre-hydration native submit).
  const role =
    /name="(?:\d+_)?role"\r\n\r\n([A-Z_]+)/.exec(body)?.[1] ??
    /(?:^|&)(?:\d+_)?role=([A-Z_]+)/.exec(body)?.[1];
  expect(role, `role not found in submitted body: ${body.slice(0, 300)}`).toBe("FINANCE");
});
