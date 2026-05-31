import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function listRouteFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? listRouteFiles(path)
      : entry.name === "route.ts"
        ? [path]
        : [];
  });
}

test("every superadmin API route requires an allowlisted superadmin session", () => {
  const directory = join(process.cwd(), "src", "app", "api", "superadmin");
  const routes = listRouteFiles(directory);

  assert.equal(routes.length > 0, true);
  for (const route of routes) {
    assert.match(readFileSync(route, "utf8"), /requireSuperAdminSession/);
  }
});

test("superadmin page layout requires an allowlisted superadmin session", () => {
  const layout = readFileSync(
    join(process.cwd(), "src", "app", "(superadmin)", "superadmin", "layout.tsx"),
    "utf8",
  );

  assert.match(layout, /requireSuperAdminSession/);
});
