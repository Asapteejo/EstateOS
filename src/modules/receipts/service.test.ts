import test from "node:test";
import assert from "node:assert/strict";

import { canViewerAccessReceipt } from "@/modules/receipts/service";

test("receipt access allows tenant admin viewers", () => {
  assert.equal(
    canViewerAccessReceipt({
      isAdmin: true,
      viewerUserId: "admin_1",
      transactionUserId: "buyer_1",
      paymentUserId: "buyer_1",
    }),
    true,
  );
});

test("receipt access only allows buyer owners when viewer is not admin", () => {
  assert.equal(
    canViewerAccessReceipt({
      isAdmin: false,
      viewerUserId: "buyer_1",
      transactionUserId: "buyer_1",
      paymentUserId: "buyer_2",
    }),
    true,
  );

  assert.equal(
    canViewerAccessReceipt({
      isAdmin: false,
      viewerUserId: "buyer_3",
      transactionUserId: "buyer_1",
      paymentUserId: "buyer_2",
    }),
    false,
  );
});
