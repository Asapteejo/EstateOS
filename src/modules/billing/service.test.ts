import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("tenant billing dashboard omits platform commission fields for non-superadmins", () => {
  const serviceSource = readFileSync(
    join(process.cwd(), "src", "modules", "billing", "service.ts"),
    "utf8",
  );
  const componentSource = readFileSync(
    join(process.cwd(), "src", "components", "admin", "billing-management.tsx"),
    "utf8",
  );
  const pageSource = readFileSync(
    join(process.cwd(), "src", "app", "(admin)", "admin", "billing", "page.tsx"),
    "utf8",
  );

  assert.match(serviceSource, /\.\.\.\(context\.isSuperAdmin[\s\S]+\?[\s\S]+\{[\s\S]+commissionRule/);
  assert.match(serviceSource, /context\.isSuperAdmin && companyId[\s\S]+\?[\s\S]+countForTenant\(prisma\.commissionRecord/);
  assert.match(serviceSource, /context\.isSuperAdmin && companyId[\s\S]+\?[\s\S]+prisma\.commissionRecord\.aggregate/);
  assert.match(serviceSource, /commissionEarned\?: string/);
  assert.match(serviceSource, /subscriptionRevenue\?: string/);
  assert.match(componentSource, /isSuperAdmin && companySummary\.commissionEarned/);
  assert.match(componentSource, /isSuperAdmin && companyBilling\.commissionRule/);
  assert.match(pageSource, /tenant\.isSuperAdmin[\s\S]+\?[\s\S]+"Plans, grants, commission behavior/);
});
