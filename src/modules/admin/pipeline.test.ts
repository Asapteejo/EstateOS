import test from "node:test";
import assert from "node:assert/strict";

import { buildSalesPipelineCards } from "@/modules/admin/queries";

test("sales pipeline cards preserve counts and outstanding balance summaries", () => {
  const cards = buildSalesPipelineCards({
    inquiries: 14,
    newInquiries: 5,
    inspections: 4,
    confirmedInspections: 2,
    reservations: 3,
    paymentsInProgress: 6,
    outstandingBalance: 125000000,
    completedDeals: 2,
  });

  assert.equal(cards[0]?.count, 14);
  assert.equal(cards[0]?.detail, "5 new");
  assert.equal(cards[3]?.count, 6);
  assert.match(cards[3]?.detail ?? "", /125/);
});
