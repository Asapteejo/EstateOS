import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("tenant domain API keeps admin guard and delegates to shared service", () => {
  const source = readFileSync(join(process.cwd(), "src", "app", "api", "admin", "domain", "route.ts"), "utf8");

  assert.match(source, /requireAdminSession\(\["ADMIN"\]/);
  assert.match(source, /setCompanyCustomDomain/);
});

test("superadmin domain API requires superadmin guard and exposes management actions", () => {
  const source = readFileSync(
    join(process.cwd(), "src", "app", "api", "superadmin", "companies", "[companyId]", "domain", "route.ts"),
    "utf8",
  );

  assert.match(source, /requireSuperAdminSession/);
  assert.match(source, /markCompanyCustomDomainSkipped/);
  assert.match(source, /removeCompanyCustomDomain/);
  assert.match(source, /verifyCompanyCustomDomain/);
});
