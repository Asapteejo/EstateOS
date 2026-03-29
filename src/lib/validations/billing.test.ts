import test from "node:test";
import assert from "node:assert/strict";

import {
  billingPlanUpsertSchema,
  companySubscriptionAssignmentSchema,
} from "@/lib/validations/billing";

test("billing plan schema supports monthly and annual plans", () => {
  const monthly = billingPlanUpsertSchema.parse({
    code: "growth",
    slug: "growth-monthly",
    name: "Growth",
    interval: "MONTHLY",
    priceAmount: 150000,
    currency: "ngn",
  });

  const annual = billingPlanUpsertSchema.parse({
    code: "growth",
    slug: "growth-annual",
    name: "Growth",
    interval: "ANNUAL",
    priceAmount: 1500000,
    currency: "usd",
  });

  assert.equal(monthly.currency, "NGN");
  assert.equal(annual.currency, "USD");
});

test("manual grants require a reason", () => {
  const parsed = companySubscriptionAssignmentSchema.safeParse({
    companyId: "company-1",
    planId: "plan-1",
    status: "GRANTED",
  });

  assert.equal(parsed.success, false);
});
