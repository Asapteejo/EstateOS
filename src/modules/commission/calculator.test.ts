import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCommissionAmount,
  getMarketerCommissionTotals,
  recordMarketerCommission,
} from "@/modules/commission/calculator";

test("commission calculator handles flat and percentage rules", () => {
  assert.equal(
    calculateCommissionAmount(1000000, {
      id: "rule_flat",
      feeType: "FLAT",
      flatAmount: 25000,
      percentageRate: null,
      currency: "NGN",
    }),
    25000,
  );
  assert.equal(
    calculateCommissionAmount(1000000, {
      id: "rule_percentage",
      feeType: "PERCENTAGE",
      flatAmount: null,
      percentageRate: 2.5,
      currency: "NGN",
    }),
    25000,
  );
  assert.equal(
    calculateCommissionAmount(1000000, {
      id: "rule_invalid",
      feeType: "PERCENTAGE",
      flatAmount: null,
      percentageRate: null,
      currency: "NGN",
    }),
    0,
  );
});

test("recordMarketerCommission writes marketerId, not teamMemberId", async () => {
  let createArgs: unknown;
  const delegate = {
    create: async (args?: unknown) => {
      createArgs = args;
      return { id: "commission_1" };
    },
    findMany: async () => [],
    aggregate: async () => ({}),
  };

  await recordMarketerCommission(
    {
      companyId: "company_1",
      marketerId: "marketer_1",
      paymentId: "payment_1",
      transactionId: "transaction_1",
      ruleId: "rule_1",
      amount: 50000,
      currency: "NGN",
    },
    delegate,
    { hasDatabase: true },
  );

  assert.deepEqual((createArgs as { data: Record<string, unknown> }).data, {
    companyId: "company_1",
    marketerId: "marketer_1",
    paymentId: "payment_1",
    transactionId: "transaction_1",
    ruleId: "rule_1",
    amount: 50000,
    currency: "NGN",
    status: "PENDING",
  });
  assert.equal("teamMemberId" in (createArgs as { data: Record<string, unknown> }).data, false);
});

test("marketer commission totals select and aggregate by marketerId", async () => {
  let findManyArgs: unknown;
  const delegate = {
    create: async () => ({}),
    findMany: async (args?: unknown) => {
      findManyArgs = args;
      return [
        { marketerId: "marketer_1", amount: { toNumber: () => 1000 }, status: "PENDING" },
        { marketerId: "marketer_1", amount: 2000, status: "PAID" },
        { marketerId: "marketer_2", amount: 3000, status: "PENDING" },
      ];
    },
    aggregate: async () => ({}),
  };

  const totals = await getMarketerCommissionTotals("company_1", delegate, {
    hasDatabase: true,
  });

  assert.deepEqual((findManyArgs as { where: unknown; select: Record<string, boolean> }).where, {
    companyId: "company_1",
  });
  assert.deepEqual((findManyArgs as { where: unknown; select: Record<string, boolean> }).select, {
    marketerId: true,
    amount: true,
    status: true,
  });
  assert.equal(
    "teamMemberId" in (findManyArgs as { where: unknown; select: Record<string, boolean> }).select,
    false,
  );
  assert.deepEqual(totals.get("marketer_1"), {
    pending: 1000,
    paid: 2000,
    lifetime: 3000,
  });
  assert.deepEqual(totals.get("marketer_2"), {
    pending: 3000,
    paid: 0,
    lifetime: 3000,
  });
});
