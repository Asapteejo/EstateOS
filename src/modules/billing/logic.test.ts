import test from "node:test";
import assert from "node:assert/strict";

import {
  addIntervalToDate,
  buildSettlementPreview,
  calculateCommissionBreakdown,
  canPlanUseFeature,
  resolveCompanyPlanStatus,
} from "@/modules/billing/logic";

test("active subscription calculation prefers current in-window plans", () => {
  const status = resolveCompanyPlanStatus([
    {
      id: "sub-1",
      status: "EXPIRED",
      isCurrent: false,
      startsAt: new Date("2025-01-01T00:00:00.000Z"),
      endsAt: new Date("2025-02-01T00:00:00.000Z"),
      plan: {
        id: "plan-starter",
        code: "starter",
        slug: "starter-monthly",
        name: "Starter",
        interval: "MONTHLY",
      },
    },
    {
      id: "sub-2",
      status: "ACTIVE",
      isCurrent: true,
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2026-02-01T00:00:00.000Z"),
      plan: {
        id: "plan-growth",
        code: "growth",
        slug: "growth-monthly",
        name: "Growth",
        interval: "MONTHLY",
        featureFlags: {
          TRANSACTIONS: true,
        },
      },
    },
  ], new Date("2026-01-15T00:00:00.000Z"));

  assert.equal(status.state, "ACTIVE");
  assert.equal(status.plan?.slug, "growth-monthly");
});

test("granted plans remain active and feature-eligible", () => {
  const status = resolveCompanyPlanStatus([
    {
      id: "sub-1",
      status: "GRANTED",
      isCurrent: true,
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2027-01-01T00:00:00.000Z"),
      plan: {
        id: "plan-growth",
        code: "growth",
        slug: "growth-annual",
        name: "Growth",
        interval: "ANNUAL",
        featureFlags: {
          TRANSACTIONS: true,
          ADMIN_OPERATIONS: true,
        },
      },
      grantReason: "Pilot support",
    },
  ], new Date("2026-06-01T00:00:00.000Z"));

  assert.equal(status.state, "ACTIVE");
  assert.equal(status.isGranted, true);
  assert.equal(canPlanUseFeature(status, "TRANSACTIONS"), true);
});

test("commission still applies when company plan was granted", () => {
  const breakdown = calculateCommissionBreakdown({
    grossAmount: 12_500_000,
    rule: {
      feeType: "FLAT",
      flatAmount: 25_000,
      currency: "NGN",
    },
    currency: "NGN",
  });

  assert.equal(breakdown.platformCommission, 25_000);
  assert.equal(breakdown.companyAmount, 12_475_000);
});

test("split calculation builds provider-specific payload for paystack", () => {
  const preview = buildSettlementPreview({
    provider: "PAYSTACK",
    payoutAccount: {
      id: "acct-1",
      provider: "PAYSTACK",
      accountReference: "acct-ref",
      subaccountCode: "ACCT_demo",
      settlementCurrency: "NGN",
      supportsTransactionSplit: true,
      status: "ACTIVE",
    },
    breakdown: {
      grossAmount: 100000,
      providerFee: 0,
      platformCommission: 5000,
      companyAmount: 95000,
      netAmount: 95000,
      currency: "NGN",
    },
  });

  assert.equal(preview.ready, true);
  if (preview.ready) {
    assert.equal(preview.providerPayload.paystack?.["subaccount"], "ACCT_demo");
  }
});

test("monthly and annual interval helpers preserve billing semantics", () => {
  const start = new Date("2026-01-31T00:00:00.000Z");

  const monthly = addIntervalToDate(start, "MONTHLY");
  const annual = addIntervalToDate(start, "ANNUAL");

  assert.equal(monthly.getUTCMonth(), 2);
  assert.equal(annual.getUTCFullYear(), 2027);
});
