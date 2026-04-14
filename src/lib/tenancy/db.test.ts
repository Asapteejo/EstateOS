import test from "node:test";
import assert from "node:assert/strict";
import type { AppRole } from "@prisma/client";

import {
  findManyPublicForTenant,
  rejectUnsafeCompanyIdInput,
  scopePublicTenantQueryArgs,
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

test("scopePublicTenantQueryArgs only adds published filter when requested", () => {
  assert.deepEqual(
    scopePublicTenantQueryArgs(
      tenantContext,
      {
        where: {
          sortOrder: {
            gt: 0,
          },
        },
      },
      { modelName: "Testimonial", publishedOnly: true },
    ),
    {
      where: {
        sortOrder: {
          gt: 0,
        },
        companyId: "company_123",
        isPublished: true,
      },
    },
  );
});

test("scopePublicTenantQueryArgs only adds active filter when explicitly requested", () => {
  assert.deepEqual(
    scopePublicTenantQueryArgs(
      tenantContext,
      {
        where: {},
      },
      { modelName: "TeamMember", publishedOnly: true, activeOnly: true },
    ),
    {
      where: {
        companyId: "company_123",
        isPublished: true,
        isActive: true,
      },
    },
  );
});

test("findManyPublicForTenant applies opt-in public visibility filters", async () => {
  const calls: Array<Record<string, unknown> | undefined> = [];
  const model = {
    async findMany(args?: unknown) {
      calls.push(args as Record<string, unknown> | undefined);
      return [];
    },
  };

  await findManyPublicForTenant(
    model,
    tenantContext,
    {
      where: {
        sortOrder: {
          gt: 0,
        },
      },
    },
    { modelName: "Testimonial", publishedOnly: true },
  );

  assert.deepEqual(calls[0], {
    where: {
      sortOrder: {
        gt: 0,
      },
      companyId: "company_123",
      isPublished: true,
    },
  });
});

test("scopeTenantWhere supports relation-based staff profile scoping", () => {
  assert.deepEqual(
    scopeTenantWhere(
      tenantContext,
      { isAssignable: true },
      { modelName: "StaffProfile", strategy: "staffProfileUserCompanyId" },
    ),
    {
      isAssignable: true,
      user: {
        companyId: "company_123",
      },
    },
  );
});

test("relation-based staff profile scoping preserves nested user filters", () => {
  assert.deepEqual(
    scopeTenantWhere(
      tenantContext,
      {
        isAssignable: true,
        user: {
          firstName: {
            startsWith: "Ada",
          },
        },
      },
      { modelName: "StaffProfile", strategy: "staffProfileUserCompanyId" },
    ),
    {
      isAssignable: true,
      user: {
        firstName: {
          startsWith: "Ada",
        },
        companyId: "company_123",
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
