import test from "node:test";
import assert from "node:assert/strict";

import {
  assertProvisioningCompanyExists,
  assertProvisioningCompanyMatch,
  buildManualTenantAdminUser,
  parseProvisionTenantAdminArgs,
  TENANT_ADMIN_ROLE,
} from "@/lib/ops/tenant-provisioning";

test("tenant admin provisioning parses and normalizes explicit CLI arguments", () => {
  assert.deepEqual(
    parseProvisionTenantAdminArgs([
      "--companySlug",
      " Blueprint-Urban-Residences ",
      "--email",
      " Admin@Example.com ",
      "--name",
      "Ada Admin",
    ]),
    {
      companySlug: "blueprint-urban-residences",
      email: "admin@example.com",
      name: "Ada Admin",
    },
  );
});

test("tenant admin provisioning creates a Clerk-linkable local placeholder without superadmin", () => {
  const user = buildManualTenantAdminUser({
    companySlug: "blueprint-urban-residences",
    email: "admin@example.com",
    name: "Ada Admin",
  });

  assert.equal(user.clerkUserId, "manual:admin@example.com");
  assert.equal(TENANT_ADMIN_ROLE, "ADMIN");
  assert.equal(JSON.stringify(user).includes("SUPER_ADMIN"), false);
});

test("tenant admin provisioning refuses unknown companies and cross-tenant user moves", () => {
  assert.throws(
    () => assertProvisioningCompanyExists(null, "missing-company"),
    /Company not found/,
  );
  assert.throws(
    () => assertProvisioningCompanyMatch("company-a", "company-b"),
    /Refusing to move/,
  );
  assert.doesNotThrow(() => assertProvisioningCompanyMatch("company-a", "company-a"));
});
