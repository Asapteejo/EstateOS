import assert from "node:assert/strict";
import test from "node:test";

import {
  ADMIN_NAV,
  ADMIN_NAV_GROUPS,
  filterAdminNav,
  groupedAdminNav,
} from "@/lib/auth/admin-sections";

test("every nav item belongs to a known group", () => {
  for (const item of ADMIN_NAV) {
    assert.ok(
      (ADMIN_NAV_GROUPS as readonly string[]).includes(item.group),
      `${item.label} has unknown group ${item.group}`,
    );
  }
});

test("nav hrefs are unique", () => {
  const hrefs = ADMIN_NAV.map((item) => item.href);
  assert.equal(new Set(hrefs).size, hrefs.length);
});

test("grouping preserves exactly the visible flat nav (nothing lost, nothing added)", () => {
  for (const roles of [["ADMIN"], ["FINANCE"], ["STAFF"], ["LEGAL"], ["MARKETER"]] as const) {
    const flat = filterAdminNav([...roles]).map((item) => item.href);
    const grouped = groupedAdminNav([...roles]).flatMap((group) =>
      group.items.map(([, href]) => href),
    );
    assert.deepEqual([...grouped].sort(), [...flat].sort(), roles.join(","));
  }
});

test("groups appear in canonical order and empty groups are dropped", () => {
  const labels = groupedAdminNav(["FINANCE"]).map((group) => group.label);
  const canonicalOrder = labels.map((label) =>
    (ADMIN_NAV_GROUPS as readonly string[]).indexOf(label),
  );
  assert.deepEqual([...canonicalOrder].sort((a, b) => a - b), canonicalOrder);
  // FINANCE does no front-desk data entry, so that cluster must not render.
  assert.ok(!labels.includes("Front desk"));
});

test("owner sees no operational front-desk tools but keeps oversight sections", () => {
  const labels = groupedAdminNav(["ADMIN"]).flatMap((group) =>
    group.items.map(([label]) => label),
  );
  assert.ok(!labels.includes("Front Desk"));
  assert.ok(!labels.includes("Visitor Log"));
  assert.ok(labels.includes("Overview"));
  assert.ok(labels.includes("Audit Logs"));
});
