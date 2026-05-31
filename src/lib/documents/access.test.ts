import test from "node:test";
import assert from "node:assert/strict";
import type { AppRole } from "@prisma/client";

import { assertDocumentAccess, resolveDocumentAccessLogUserId } from "@/lib/documents/access";

const buyerContext = {
  userId: "user_1",
  companyId: "company_1",
  companySlug: "acme",
  branchId: null,
  roles: ["BUYER"] as AppRole[],
  isSuperAdmin: false,
  host: null,
  resolutionSource: "session" as const,
};

test("buyer may access their own tenant-scoped document", () => {
  assert.equal(
    assertDocumentAccess(buyerContext, {
      id: "doc_1",
      companyId: "company_1",
      userId: "user_1",
      storageKey: "company_1/private/doc.pdf",
      visibility: "PRIVATE",
      fileName: "doc.pdf",
      mimeType: "application/pdf",
      transaction: null,
    }),
    true,
  );
});

test("buyer cannot access another buyer's document in the same tenant", () => {
  assert.throws(
    () =>
      assertDocumentAccess(buyerContext, {
        id: "doc_2",
        companyId: "company_1",
        userId: "user_2",
        storageKey: "company_1/private/doc.pdf",
        visibility: "PRIVATE",
        fileName: "doc.pdf",
        mimeType: "application/pdf",
        transaction: null,
      }),
    /Document access denied/,
  );
});

test("buyer cannot access cross-tenant document", () => {
  assert.throws(
    () =>
      assertDocumentAccess(buyerContext, {
        id: "doc_3",
        companyId: "company_2",
        userId: "user_1",
        storageKey: "company_2/private/doc.pdf",
        visibility: "PRIVATE",
        fileName: "doc.pdf",
        mimeType: "application/pdf",
        transaction: null,
      }),
    /Cross-tenant access denied/,
  );
});

function createUserDelegate(users: Array<{ id: string; clerkUserId?: string; email: string; companyId: string | null }>) {
  return {
    async findFirst(args: { where: Record<string, unknown> }) {
      const where = args.where as {
        OR?: Array<Record<string, string>>;
        companyId?: string;
      };

      return users.find((user) => {
        if (where.companyId && user.companyId !== where.companyId) {
          return false;
        }

        return where.OR?.some((condition) => {
          if (condition.id) {
            return user.id === condition.id;
          }
          if (condition.clerkUserId) {
            return user.clerkUserId === condition.clerkUserId;
          }
          if (condition.email) {
            return user.email === condition.email;
          }
          return false;
        });
      }) ?? null;
    },
  };
}

test("document access log resolves buyer Clerk/dev ids to DB user ids", async () => {
  const resolved = await resolveDocumentAccessLogUserId(
    {
      ...buyerContext,
      userId: "clerk_buyer_1",
    },
    {
      email: "buyer@example.com",
      userDelegate: createUserDelegate([
        { id: "user_1", clerkUserId: "clerk_buyer_1", email: "buyer@example.com", companyId: "company_1" },
      ]),
    },
  );

  assert.equal(resolved, "user_1");
});

test("document access log resolves tenant admin users in their company", async () => {
  const resolved = await resolveDocumentAccessLogUserId(
    {
      ...buyerContext,
      userId: "demo-admin",
      roles: ["ADMIN"] as AppRole[],
    },
    {
      email: "admin@example.com",
      userDelegate: createUserDelegate([
        { id: "admin_1", clerkUserId: "demo-admin", email: "admin@example.com", companyId: "company_1" },
      ]),
    },
  );

  assert.equal(resolved, "admin_1");
});

test("document access log does not resolve cross-tenant users for tenant viewers", async () => {
  const resolved = await resolveDocumentAccessLogUserId(
    {
      ...buyerContext,
      userId: "clerk_buyer_2",
    },
    {
      email: "buyer@example.com",
      userDelegate: createUserDelegate([
        { id: "user_2", clerkUserId: "clerk_buyer_2", email: "buyer@example.com", companyId: "company_2" },
      ]),
    },
  );

  assert.equal(resolved, null);
});

test("missing document access log user resolves to null for non-blocking dev logging", async () => {
  const resolved = await resolveDocumentAccessLogUserId(
    {
      ...buyerContext,
      userId: "synthetic-user",
    },
    {
      email: "missing@example.com",
      userDelegate: createUserDelegate([]),
    },
  );

  assert.equal(resolved, null);
});
