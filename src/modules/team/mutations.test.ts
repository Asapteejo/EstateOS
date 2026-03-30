import test from "node:test";
import assert from "node:assert/strict";

import type { TenantContext } from "@/lib/tenancy/context";
import { canTenantAdminManageTeamProfiles } from "@/modules/team/mutations";

const baseContext: TenantContext = {
  userId: "user-1",
  companyId: "company-1",
  companySlug: "acme-realty",
  branchId: null,
  roles: ["ADMIN"],
  isSuperAdmin: false,
  host: "localhost:3000",
  resolutionSource: "session",
};

test("tenant admins can manage staff profiles", () => {
  assert.equal(canTenantAdminManageTeamProfiles(baseContext), true);
});

test("buyers cannot manage staff profiles", () => {
  assert.equal(
    canTenantAdminManageTeamProfiles({
      ...baseContext,
      roles: ["BUYER"],
    }),
    false,
  );
});

test("superadmins do not mutate tenant staff through tenant admin flow", () => {
  assert.equal(
    canTenantAdminManageTeamProfiles({
      ...baseContext,
      roles: ["SUPER_ADMIN"],
      isSuperAdmin: true,
    }),
    false,
  );
});
