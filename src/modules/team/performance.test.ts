import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFallbackAttributionIndex,
  buildMarketerPerformanceScore,
  buildMarketerPerformanceSummary,
  buildMarketerPerformanceTrend,
  buildMarketerSnapshotDate,
  buildMarketerSnapshotRecords,
  buildMarketerStarRating,
  sortMarketerPerformanceEntries,
  resolveAttributedMarketerId,
} from "@/modules/team/performance";

test("marketer performance score weights closed revenue signals above soft intent", () => {
  assert.equal(
    buildMarketerPerformanceScore({
      wishlistAdds: 4,
      qualifiedInquiries: 2,
      inspectionsHandled: 1,
      reservations: 2,
      successfulPayments: 1,
      completedDeals: 1,
    }),
    33,
  );
});

test("marketer star rating remains bounded and does not make everyone five stars", () => {
  assert.equal(buildMarketerStarRating(0), 3);
  assert.equal(buildMarketerStarRating(9), 4);
  assert.equal(buildMarketerStarRating(144), 5);
});

test("attribution precedence uses explicit buyer-selected marketer before fallback staff attribution", () => {
  const fallbackIndex = buildFallbackAttributionIndex([
    {
      marketerId: "fallback_marketer",
      userId: "buyer_1",
      propertyId: "property_1",
      happenedAt: new Date("2026-03-15T08:00:00.000Z"),
      source: "inspection",
    },
  ]);

  assert.equal(
    resolveAttributedMarketerId(
      {
        explicitMarketerId: "selected_marketer",
        fallbackUserId: "buyer_1",
        fallbackPropertyId: "property_1",
      },
      fallbackIndex,
    ),
    "selected_marketer",
  );

  assert.equal(
    resolveAttributedMarketerId(
      {
        explicitMarketerId: null,
        fallbackUserId: "buyer_1",
        fallbackPropertyId: "property_1",
      },
      fallbackIndex,
    ),
    "fallback_marketer",
  );
});

test("fallback attribution prefers the most recent matching activity and inspection over inquiry on ties", () => {
  const fallbackIndex = buildFallbackAttributionIndex([
    {
      marketerId: "older_inquiry",
      userId: "buyer_1",
      propertyId: "property_1",
      happenedAt: new Date("2026-03-02T08:00:00.000Z"),
      source: "inquiry",
    },
    {
      marketerId: "latest_inquiry",
      userId: "buyer_1",
      propertyId: "property_1",
      happenedAt: new Date("2026-03-06T08:00:00.000Z"),
      source: "inquiry",
    },
    {
      marketerId: "inspection_override",
      userId: "buyer_2",
      propertyId: "property_2",
      happenedAt: new Date("2026-03-07T10:00:00.000Z"),
      source: "inspection",
    },
    {
      marketerId: "same_time_inquiry",
      userId: "buyer_2",
      propertyId: "property_2",
      happenedAt: new Date("2026-03-07T10:00:00.000Z"),
      source: "inquiry",
    },
  ]);

  assert.equal(
    resolveAttributedMarketerId(
      { fallbackUserId: "buyer_1", fallbackPropertyId: "property_1" },
      fallbackIndex,
    ),
    "latest_inquiry",
  );

  assert.equal(
    resolveAttributedMarketerId(
      { fallbackUserId: "buyer_2", fallbackPropertyId: "property_2" },
      fallbackIndex,
    ),
    "inspection_override",
  );
});

test("performance summary surfaces the strongest real signals first", () => {
  assert.equal(
    buildMarketerPerformanceSummary({
      wishlistAdds: 2,
      qualifiedInquiries: 1,
      inspectionsHandled: 4,
      reservations: 3,
      successfulPayments: 2,
      completedDeals: 1,
    }),
    "1 closed deal • 2 successful payments • 3 linked reservations",
  );
});

test("snapshot date buckets marketer history by day", () => {
  assert.equal(
    buildMarketerSnapshotDate(new Date("2026-04-04T19:22:00.000Z")).toISOString(),
    "2026-04-04T00:00:00.000Z",
  );
});

test("snapshot records preserve ranking metrics for history tracking", () => {
  const [record] = buildMarketerSnapshotRecords(
    "company_1",
    [
      {
        id: "marketer_1",
        slug: "mary-jane",
        fullName: "Mary Jane",
        title: "Lead marketer",
        avatarUrl: null,
        isActive: true,
        isPublished: true,
        monthlyScore: 28,
        starRating: 4.8,
        rank: 1,
        summary: "1 closed deal • 2 successful payments",
        metrics: {
          wishlistAdds: 2,
          qualifiedInquiries: 1,
          inspectionsHandled: 1,
          reservations: 2,
          successfulPayments: 2,
          completedDeals: 1,
        },
      },
    ],
    new Date("2026-04-04T12:00:00.000Z"),
  );

  assert.equal(record.companyId, "company_1");
  assert.equal(record.teamMemberId, "marketer_1");
  assert.equal(record.score, 28);
  assert.equal(record.rank, 1);
  assert.equal(record.snapshotDate.toISOString(), "2026-04-04T00:00:00.000Z");
  assert.equal(record.completedDeals, 1);
  assert.equal(record.successfulPayments, 2);
});

test("performance trend compares current live ranking against the prior snapshot", () => {
  assert.deepEqual(
    buildMarketerPerformanceTrend(
      { monthlyScore: 24, rank: 1 },
      { score: 18, rank: 3, snapshotDate: new Date("2026-04-03T00:00:00.000Z") },
    ),
    {
      direction: "up",
      scoreDelta: 6,
      rankDelta: 2,
      previousSnapshotDate: "2026-04-03T00:00:00.000Z",
    },
  );
});

test("admin marketer sorting can prioritize payment and deal outcomes", () => {
  const sorted = sortMarketerPerformanceEntries(
    [
      {
        id: "marketer_1",
        slug: "alpha",
        fullName: "Alpha Agent",
        title: "Closer",
        avatarUrl: null,
        isActive: true,
        isPublished: true,
        monthlyScore: 10,
        starRating: 4.2,
        rank: 2,
        summary: "",
        metrics: {
          wishlistAdds: 0,
          qualifiedInquiries: 0,
          inspectionsHandled: 1,
          reservations: 2,
          successfulPayments: 1,
          completedDeals: 1,
        },
        trend: null,
      },
      {
        id: "marketer_2",
        slug: "bravo",
        fullName: "Bravo Agent",
        title: "Advisor",
        avatarUrl: null,
        isActive: true,
        isPublished: false,
        monthlyScore: 8,
        starRating: 3.9,
        rank: 1,
        summary: "",
        metrics: {
          wishlistAdds: 2,
          qualifiedInquiries: 1,
          inspectionsHandled: 0,
          reservations: 1,
          successfulPayments: 3,
          completedDeals: 0,
        },
        trend: null,
      },
    ],
    "payments",
  );

  assert.equal(sorted[0].id, "marketer_2");
  assert.equal(sorted[0].rank, 1);
  assert.equal(sorted[1].rank, 2);
});
