import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCompaniesByPlanSummary,
  buildCompanyAlertBuckets,
  classifyCompanyHealth,
  parseCompanySort,
  parseSuperadminRange,
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

test("superadmin range parsing falls back to 30d", () => {
  assert.equal(parseSuperadminRange("today"), "today");
  assert.equal(parseSuperadminRange("bad-input"), "30d");
});

test("superadmin company sort parsing defaults to highest revenue", () => {
  assert.equal(parseCompanySort("highest_overdue"), "highest_overdue");
  assert.equal(parseCompanySort("unknown"), "highest_revenue");
});

test("company health flags collections risk before normal health", () => {
  const result = classifyCompanyHealth({
    totalDeals: 4,
    propertiesCount: 2,
    teamCount: 3,
    overdueAmount: 150000,
    inflowProcessed: 2000000,
    platformRevenue: 50000,
    subscriptionStatus: "ACTIVE",
    lastActiveAt: new Date(),
  });

  assert.equal(result.health, "collections_risk");
});

test("company health flags onboarding incomplete when core setup is missing", () => {
  const result = classifyCompanyHealth({
    totalDeals: 0,
    propertiesCount: 0,
    teamCount: 1,
    overdueAmount: 0,
    inflowProcessed: 0,
    platformRevenue: 0,
    subscriptionStatus: "NO_PLAN",
    lastActiveAt: null,
  });

  assert.equal(result.health, "onboarding_incomplete");
});
