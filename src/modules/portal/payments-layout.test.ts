import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("payment summary cards wrap long values instead of clipping", () => {
  const portalPaymentsSource = readFileSync(
    join(process.cwd(), "src", "app", "(portal)", "portal", "payments", "page.tsx"),
    "utf8",
  );
  const adminPaymentsSource = readFileSync(
    join(process.cwd(), "src", "app", "(admin)", "admin", "payments", "page.tsx"),
    "utf8",
  );
  const buttonSource = readFileSync(join(process.cwd(), "src", "components", "ui", "button.tsx"), "utf8");
  const cardSource = readFileSync(join(process.cwd(), "src", "components", "ui", "card.tsx"), "utf8");
  const adminUiSource = readFileSync(join(process.cwd(), "src", "components", "admin", "admin-ui.tsx"), "utf8");
  const headerSource = readFileSync(join(process.cwd(), "src", "components", "marketing", "marketing-header.tsx"), "utf8");
  const logoSource = readFileSync(join(process.cwd(), "src", "components", "shared", "logo.tsx"), "utf8");
  const globalsSource = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");

  assert.match(portalPaymentsSource, /sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5/);
  assert.match(portalPaymentsSource, /StatCard label="Total payable"/);
  assert.match(adminPaymentsSource, /sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5/);
  assert.match(adminPaymentsSource, /<StatCard key=\{label\} label=\{label\} value=\{value\}/);
  assert.match(buttonSource, /whitespace-nowrap/);
  assert.match(buttonSource, /shrink-0/);
  assert.match(buttonSource, /active:scale-\[0\.98\]/);
  assert.match(cardSource, /shadow-\[var\(--shadow-sm\)\]/);
  assert.match(cardSource, /interactive/);
  assert.match(adminUiSource, /grid items-stretch/);
  assert.match(adminUiSource, /export const StatCard = AdminMetricCard/);
  assert.match(adminUiSource, /numeric mt-2 min-w-0 break-words text-xl font-semibold/);
  assert.match(headerSource, /whitespace-nowrap text-sm font-medium/);
  assert.match(logoSource, /hidden whitespace-nowrap/);
  assert.match(globalsSource, /--duration-fast: 120ms/);
  assert.match(globalsSource, /--tenant-motion-duration: 160ms/);
  assert.match(globalsSource, /transform: translateY\(4px\)/);
});
