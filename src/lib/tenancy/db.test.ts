import test from "node:test";
import assert from "node:assert/strict";
import type { AppRole } from "@prisma/client";

import {
  rejectUnsafeCompanyIdInput,
  scopeTenantQueryArgs,
  scopeTenantWhere,
} from "@/lib/tenancy/db";

const tenantContext = {
  userId: "user_123",
  companyId: "company_123",
  companySlug: "acme",
  branchId: null,
  roles: ["ADMIN"] as AppRole[],
  isSuperAdmin: false,
  host: null,
  resolutionSource: "session" as const,
};

test("scopeTenantWhere adds companyId for non-super-admin users", () => {
  assert.deepEqual(scopeTenantWhere(tenantContext, { status: "ACTIVE" }), {
    status: "ACTIVE",
    companyId: "company_123",
  });
});

test("scopeTenantQueryArgs preserves filters while enforcing companyId", () => {
  assert.deepEqual(
    scopeTenantQueryArgs(tenantContext, {
      where: {
        userId: "user_123",
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    {
      where: {
        userId: "user_123",
        companyId: "company_123",
      },
      orderBy: {
        createdAt: "desc",
      },
    },
  );
});

test("rejectUnsafeCompanyIdInput rejects caller-provided tenant ids", () => {
  assert.throws(
    () => rejectUnsafeCompanyIdInput({ companyId: "unsafe" }),
    /Caller-provided companyId is not allowed/,
  );
});
