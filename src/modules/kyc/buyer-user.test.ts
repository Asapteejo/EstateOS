import assert from "node:assert/strict";
import test from "node:test";

import {
  BUYER_PROFILE_NOT_INITIALIZED_MESSAGE,
  assertTenantBuyerUser,
  resolveBuyerDbUserForKyc,
  resolveBuyerTenantContextForKyc,
  selectTenantBuyerUser,
} from "@/modules/kyc/buyer-user";

const companyUser = {
  id: "db-user-1",
  email: "buyer@acmerealty.dev",
  companyId: "company_1",
};

test("KYC user selection prefers a user scoped to the current tenant", () => {
  const selected = selectTenantBuyerUser({
    companyId: "company_1",
    byId: null,
    byClerkUserId: null,
    byEmail: companyUser,
  });

  assert.deepEqual(selected, companyUser);
});

test("KYC user selection rejects users from another tenant", () => {
  const selected = selectTenantBuyerUser({
    companyId: "company_1",
    byId: { id: "other", email: "buyer@acmerealty.dev", companyId: "company_2" },
    byClerkUserId: null,
    byEmail: { id: "other", email: "buyer@acmerealty.dev", companyId: "company_2" },
  });

  assert.equal(selected, null);
  assert.throws(
    () => assertTenantBuyerUser(selected, "company_1"),
    new RegExp(BUYER_PROFILE_NOT_INITIALIZED_MESSAGE),
  );
});

test("dev buyer synthetic id resolves to existing email user without creating duplicates", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const resolved = await resolveBuyerDbUserForKyc(
    {
      companyId: "company_1",
      userId: "demo-buyer",
    },
    {
      email: "buyer@acmerealty.dev",
      userDelegate: {
        async findFirst(args) {
          calls.push(args.where);
          if (args.where.email === "buyer@acmerealty.dev") {
            return companyUser;
          }
          return null;
        },
      },
    },
  );

  assert.equal(resolved.id, "db-user-1");
  assert.equal(calls.some((where) => where.email === "buyer@acmerealty.dev"), true);
});

test("missing buyer profile returns a clear initialization error", async () => {
  await assert.rejects(
    () =>
      resolveBuyerDbUserForKyc(
        {
          companyId: "company_1",
          userId: "demo-buyer",
        },
        {
          email: "buyer@acmerealty.dev",
          userDelegate: {
            async findFirst() {
              return null;
            },
          },
        },
      ),
    new RegExp(BUYER_PROFILE_NOT_INITIALIZED_MESSAGE),
  );
});

test("resolved buyer tenant context replaces synthetic id with database user id", async () => {
  const context = await resolveBuyerTenantContextForKyc(
    {
      userId: "demo-buyer",
      companyId: "company_1",
      companySlug: "acme",
      branchId: null,
      roles: ["BUYER"],
      isSuperAdmin: false,
      host: null,
      resolutionSource: "session",
    },
    {
      email: "buyer@acmerealty.dev",
      userDelegate: {
        async findFirst(args) {
          if (args.where.email === "buyer@acmerealty.dev") {
            return companyUser;
          }
          return null;
        },
      },
    },
  );

  assert.equal(context.userId, "db-user-1");
  assert.equal(context.companyId, "company_1");
});
