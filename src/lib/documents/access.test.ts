import test from "node:test";
import assert from "node:assert/strict";
import type { AppRole } from "@prisma/client";

import { assertDocumentAccess } from "@/lib/documents/access";

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
        transaction: null,
      }),
    /Cross-tenant access denied/,
  );
});
