import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCompaniesByPlanSummary,
  buildCompanyAlertBuckets,
} from "@/modules/superadmin/queries";

test("superadmin plan summary groups companies by current plan label", () => {
  const summary = buildCompaniesByPlanSummary([
    {
      companyName: "Acme Realty",
      subscriptionStatus: "GRANTED",
      planName: "Growth",
      interval: "ANNUAL",
      hasActivePayout: true,
    },
    {
      companyName: "Northstar Estates",
      subscriptionStatus: "ACTIVE",
      planName: "Growth",
      interval: "ANNUAL",
      hasActivePayout: true,
    },
    {
      companyName: "Harbor Homes",
      subscriptionStatus: null,
      planName: null,
      interval: null,
      hasActivePayout: false,
    },
  ]);

  assert.deepEqual(summary, [
    { label: "Growth annual", count: 2 },
    { label: "No valid plan", count: 1 },
  ]);
});

test("superadmin alert buckets isolate no-plan and payout gaps", () => {
  const alerts = buildCompanyAlertBuckets([
    {
      companyName: "Acme Realty",
      subscriptionStatus: "GRANTED",
      planName: "Growth",
      interval: "ANNUAL",
      hasActivePayout: true,
    },
    {
      companyName: "Harbor Homes",
      subscriptionStatus: null,
      planName: null,
      interval: null,
      hasActivePayout: false,
    },
  ]);

  assert.equal(alerts.noValidPlan, 1);
  assert.equal(alerts.missingPayoutSetup, 1);
});
