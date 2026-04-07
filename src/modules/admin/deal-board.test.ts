import assert from "node:assert/strict";
import test from "node:test";

import { classifyDealStage } from "@/modules/admin/deal-board";
import { buildDailyActionCards, deriveColdClientFlag } from "@/modules/admin/control-center";

test("classifyDealStage sends overdue deals into the overdue column", () => {
  assert.equal(
    classifyDealStage({
      paymentStatus: "OVERDUE",
      currentStage: "ALLOCATION_IN_PROGRESS",
      totalValue: 100_000_000,
      outstandingBalance: 20_000_000,
    }),
    "OVERDUE",
  );
});

test("classifyDealStage keeps early unpaid deals in reserved", () => {
  assert.equal(
    classifyDealStage({
      paymentStatus: "PENDING",
      currentStage: "KYC_SUBMITTED",
      totalValue: 90_000_000,
      outstandingBalance: 90_000_000,
    }),
    "RESERVED",
  );
});

test("classifyDealStage marks partially paid active deals as payment pending", () => {
  assert.equal(
    classifyDealStage({
      paymentStatus: "PARTIAL",
      currentStage: "ALLOCATION_IN_PROGRESS",
      totalValue: 120_000_000,
      outstandingBalance: 35_000_000,
    }),
    "PAYMENT_PENDING",
  );
});

test("classifyDealStage marks completed deals as paid", () => {
  assert.equal(
    classifyDealStage({
      paymentStatus: "COMPLETED",
      currentStage: "FINAL_PAYMENT_COMPLETED",
      totalValue: 120_000_000,
      outstandingBalance: 0,
    }),
    "PAID",
  );
});

test("deriveColdClientFlag requires both open intent and stale activity", () => {
  const now = new Date("2026-04-07T12:00:00.000Z");

  assert.equal(
    deriveColdClientFlag({
      latestActivityAt: new Date("2026-04-01T11:00:00.000Z"),
      hasOpenIntent: true,
      now,
      staleDays: 5,
    }),
    true,
  );

  assert.equal(
    deriveColdClientFlag({
      latestActivityAt: new Date("2026-04-05T11:00:00.000Z"),
      hasOpenIntent: true,
      now,
      staleDays: 5,
    }),
    false,
  );
});

test("buildDailyActionCards keeps collection work explicit", () => {
  const cards = buildDailyActionCards({
    clientsNeedingFollowUp: 7,
    expiringWishlists: 2,
    upcomingInspections: 3,
    overduePayments: 4,
  });

  assert.equal(cards[3]?.label, "Overdue payments");
  assert.equal(cards[3]?.href, "/admin/payments");
  assert.equal(cards[3]?.value, 4);
});
