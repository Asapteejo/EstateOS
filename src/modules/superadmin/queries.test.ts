import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCompaniesByPlanSummary,
  buildCompanyAlertBuckets,
  buildEmptyCompanyMetricRow,
  buildEmptySuperadminActivityData,
  buildEmptySuperadminControlsData,
  classifyCompanyHealth,
  limitSuperadminRows,
  parseCompanyHealthFilter,
  parseCompanyQuickFilter,
  parseCompanySort,
  parseSuperadminRange,
  readSuperadminSearchParam,
  SUPERADMIN_ACTIVITY_FEED_LIMIT,
  SUPERADMIN_COMPANY_TABLE_LIMIT,
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
  assert.equal(parseCompanySort("most_active"), "most_active");
  assert.equal(parseCompanySort("highest_inflow"), "highest_inflow");
  assert.equal(parseCompanySort("unknown"), "highest_revenue");
});

test("superadmin company and activity tables stay bounded", () => {
  const rows = Array.from({ length: 300 }, (_, index) => index);

  assert.equal(limitSuperadminRows(rows, SUPERADMIN_COMPANY_TABLE_LIMIT).length, 100);
  assert.equal(limitSuperadminRows(rows, SUPERADMIN_ACTIVITY_FEED_LIMIT).length, 28);
});

test("superadmin company quick filters accept supported dashboard links and reject unknown values", () => {
  assert.equal(parseCompanyQuickFilter("payout-missing"), "payout-missing");
  assert.equal(parseCompanyQuickFilter("inactive"), "inactive");
  assert.equal(parseCompanyQuickFilter("collections-risk"), "collections-risk");
  assert.equal(parseCompanyQuickFilter("unknown"), "all");
});

test("superadmin company health filters and repeated query parameters fall back safely", () => {
  assert.equal(parseCompanyHealthFilter("collections_risk"), "collections_risk");
  assert.equal(parseCompanyHealthFilter("unknown"), "all");
  assert.equal(readSuperadminSearchParam(["inactive", "unexpected"]), undefined);
});

test("company detail fallback tolerates missing optional relations", () => {
  const row = buildEmptyCompanyMetricRow({
    id: "company_1",
    name: "Acme Realty",
    slug: "acme-realty",
    status: "ACTIVE",
    suspendedAt: null,
    suspensionReason: null,
    customDomain: null,
    subdomain: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  });

  assert.equal(row.subscriptionStatus, "NO_PLAN");
  assert.equal(row.providerReadinessLabel, "Payout setup missing");
  assert.equal(row.platformRevenue, 0);
  assert.equal(row.lastActiveLabel, "No activity yet");
});

test("settings fallback renders zero-state controls when optional configuration is missing", () => {
  const controls = buildEmptySuperadminControlsData();

  assert.equal(controls.controls.missingPayoutSetup, 0);
  assert.deepEqual(controls.plans, []);
  assert.deepEqual(controls.companiesNeedingAttention, []);
});

test("activity fallback renders an empty feed when no activity events exist", () => {
  const activity = buildEmptySuperadminActivityData();

  assert.deepEqual(activity.items, []);
  assert.deepEqual(activity.counts, {
    payments: 0,
    paymentRequests: 0,
    onboarding: 0,
    risk: 0,
  });
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
