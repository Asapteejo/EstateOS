import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFallbackAttributionIndex,
  buildMarketerPerformanceScore,
  buildMarketerPerformanceSummary,
  buildMarketerStarRating,
  buildStaffProfileMarketerMap,
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

test("staff-profile fallback mapping prefers exact tenant email or staff code matches", () => {
  const mapping = buildStaffProfileMarketerMap(
    [
      { id: "marketer_1", email: "agent@estateos.dev", staffCode: null },
      { id: "marketer_2", email: null, staffCode: "STAFF-22" },
    ],
    [
      { id: "staff_1", staffCode: null, user: { email: "agent@estateos.dev" } },
      { id: "staff_2", staffCode: "STAFF-22", user: { email: "other@estateos.dev" } },
      { id: "staff_3", staffCode: null, user: { email: "nomatch@estateos.dev" } },
    ],
  );

  assert.equal(mapping.get("staff_1"), "marketer_1");
  assert.equal(mapping.get("staff_2"), "marketer_2");
  assert.equal(mapping.has("staff_3"), false);
});

test("staff-profile fallback mapping skips ambiguous duplicate matches", () => {
  const mapping = buildStaffProfileMarketerMap(
    [
      { id: "marketer_1", email: "shared@estateos.dev", staffCode: null },
      { id: "marketer_2", email: "shared@estateos.dev", staffCode: null },
    ],
    [{ id: "staff_1", staffCode: null, user: { email: "shared@estateos.dev" } }],
  );

  assert.equal(mapping.has("staff_1"), false);
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
