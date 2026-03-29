import test from "node:test";
import assert from "node:assert/strict";

import {
  isBuyerOwnedDocumentRecord,
  isBuyerOwnedTransactionRecord,
} from "@/modules/portal/access";

test("buyer transaction ownership requires matching tenant and user", () => {
  assert.equal(
    isBuyerOwnedTransactionRecord({
      viewerCompanyId: "company_1",
      viewerUserId: "user_1",
      recordCompanyId: "company_1",
      recordUserId: "user_1",
    }),
    true,
  );

  assert.equal(
    isBuyerOwnedTransactionRecord({
      viewerCompanyId: "company_1",
      viewerUserId: "user_1",
      recordCompanyId: "company_2",
      recordUserId: "user_1",
    }),
    false,
  );
});

test("buyer document ownership accepts direct or transaction-backed ownership only", () => {
  assert.equal(
    isBuyerOwnedDocumentRecord({
      viewerCompanyId: "company_1",
      viewerUserId: "user_1",
      documentUserId: "user_1",
    }),
    true,
  );

  assert.equal(
    isBuyerOwnedDocumentRecord({
      viewerCompanyId: "company_1",
      viewerUserId: "user_1",
      transactionCompanyId: "company_1",
      transactionUserId: "user_1",
    }),
    true,
  );

  assert.equal(
    isBuyerOwnedDocumentRecord({
      viewerCompanyId: "company_1",
      viewerUserId: "user_1",
      transactionCompanyId: "company_1",
      transactionUserId: "user_2",
    }),
    false,
  );
});
