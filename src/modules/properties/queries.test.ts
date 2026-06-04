import test from "node:test";
import assert from "node:assert/strict";
import type { AppRole } from "@prisma/client";

import {
  buildRadiusBoundingBox,
  buildPropertyBrochureHref,
  buildPublicPropertyFilterWhere,
  buildPublicPropertyWhere,
  calculateDistanceKm,
  hasRadiusPropertySearch,
  parsePropertySearchParams,
  normalizePlotOptions,
  resolvePublicPropertyVideoUrl,
} from "@/modules/properties/queries";

const marketingTenant = {
  userId: null,
  companyId: "company_1",
  companySlug: "acme",
  branchId: null,
  roles: [] as AppRole[],
  isSuperAdmin: false,
  host: "acme.localhost:3000",
  resolutionSource: "subdomain" as const,
};

const now = new Date("2026-04-02T00:00:00.000Z");

test("public property where clause is tenant-aware", () => {
  assert.deepEqual(buildPublicPropertyWhere(marketingTenant, { slug: "eko-atrium-residences" }, now), {
    AND: [
      { slug: "eko-atrium-residences" },
      {
        isPubliclyVisible: true,
        verificationStatus: {
          in: ["VERIFIED", "STALE"],
        },
      },
    ],
    status: {
      in: ["AVAILABLE", "RESERVED", "SOLD"],
    },
    companyId: "company_1",
  });
});

test("public property where clause filters out draft and archived rows", () => {
  assert.deepEqual(buildPublicPropertyWhere(marketingTenant, undefined, now), {
    AND: [
      {},
      {
        isPubliclyVisible: true,
        verificationStatus: {
          in: ["VERIFIED", "STALE"],
        },
      },
    ],
    status: {
      in: ["AVAILABLE", "RESERVED", "SOLD"],
    },
    companyId: "company_1",
  });
});

test("public active property query requires tenant, visible status, and public verification", () => {
  assert.deepEqual(buildPublicPropertyWhere(marketingTenant, { slug: "blueprint-urban-residences" }, now), {
    AND: [
      { slug: "blueprint-urban-residences" },
      {
        isPubliclyVisible: true,
        verificationStatus: {
          in: ["VERIFIED", "STALE"],
        },
      },
    ],
    status: {
      in: ["AVAILABLE", "RESERVED", "SOLD"],
    },
    companyId: "company_1",
  });
});

test("public property filter supports land listings without bedroom filters", () => {
  assert.deepEqual(
    buildPublicPropertyFilterWhere(marketingTenant, {
      propertyType: "LAND",
      page: 1,
    }, now),
    {
      companyId: "company_1",
      AND: [
        {
          AND: [
            { propertyType: "LAND" },
          ],
        },
        {
          isPubliclyVisible: true,
          verificationStatus: {
            in: ["VERIFIED", "STALE"],
          },
        },
      ],
      status: {
        in: ["AVAILABLE", "RESERVED", "SOLD"],
      },
    },
  );
});

test("public property filter where includes URL-backed filters", () => {
  assert.deepEqual(
    buildPublicPropertyFilterWhere(marketingTenant, {
      location: "Lagos",
      propertyType: "APARTMENT",
      minPrice: 1000000,
      maxPrice: 5000000,
      bedrooms: 3,
      status: "AVAILABLE",
      hasPaymentPlan: true,
      featured: true,
      page: 1,
    }, now),
    {
      companyId: "company_1",
      AND: [
        {
          AND: [
            {
              OR: [
                { locationSummary: { contains: "Lagos", mode: "insensitive" } },
                { location: { city: { contains: "Lagos", mode: "insensitive" } } },
                { location: { state: { contains: "Lagos", mode: "insensitive" } } },
                { title: { contains: "Lagos", mode: "insensitive" } },
              ],
            },
            { propertyType: "APARTMENT" },
            { status: "AVAILABLE" },
            { isFeatured: true },
            {
              OR: [
                { hasPaymentPlan: true },
                { paymentPlans: { some: { isActive: true } } },
              ],
            },
            {
              OR: [
                { bedrooms: { gte: 3 } },
                { units: { some: { bedrooms: { gte: 3 } } } },
              ],
            },
            {
              OR: [
                { priceFrom: { gte: 1000000 } },
                { units: { some: { price: { gte: 1000000 } } } },
              ],
            },
            {
              OR: [
                { priceFrom: { lte: 5000000 } },
                { priceTo: { lte: 5000000 } },
                { units: { some: { price: { lte: 5000000 } } } },
              ],
            },
          ],
        },
        {
          isPubliclyVisible: true,
          verificationStatus: {
            in: ["VERIFIED", "STALE"],
          },
        },
      ],
      status: {
        in: ["AVAILABLE", "RESERVED", "SOLD"],
      },
    },
  );
});

test("property location radius params parse safely", () => {
  assert.deepEqual(
    parsePropertySearchParams({
      location: "Lekki Phase 1",
      latitude: "6.4474",
      longitude: "3.4723",
      radiusKm: "10",
    }),
    {
      location: "Lekki Phase 1",
      latitude: 6.4474,
      longitude: 3.4723,
      radiusKm: 10,
      page: 1,
    },
  );
});

test("public property radius filter adds a coordinate bounding box", () => {
  const where = buildPublicPropertyFilterWhere(marketingTenant, {
    latitude: 6.4474,
    longitude: 3.4723,
    radiusKm: 10,
    page: 1,
  }, now);

  assert.ok(where);
  const filters = (where.AND as Array<Record<string, unknown>>)[0] as { AND: Array<Record<string, unknown>> };
  assert.equal(filters.AND.some((item) => "location" in item), true);
  assert.equal(hasRadiusPropertySearch({ latitude: 6.4474, longitude: 3.4723, radiusKm: 10, page: 1 }), true);
  assert.equal(hasRadiusPropertySearch({ latitude: 6.4474, longitude: 3.4723, page: 1 }), false);
});

test("radius helpers calculate useful geographic bounds and distance", () => {
  const bounds = buildRadiusBoundingBox({
    latitude: 6.4474,
    longitude: 3.4723,
    radiusKm: 10,
    page: 1,
  });

  assert.ok(bounds);
  assert.equal(bounds.minLatitude < 6.4474, true);
  assert.equal(bounds.maxLatitude > 6.4474, true);
  assert.equal(bounds.minLongitude < 3.4723, true);
  assert.equal(bounds.maxLongitude > 3.4723, true);
  assert.equal(
    calculateDistanceKm(
      { latitude: 6.4474, longitude: 3.4723 },
      { latitude: 6.4474, longitude: 3.4723 },
    ),
    0,
  );
});

test("invalid property search params fall back to defaults", () => {
  assert.deepEqual(
    parsePropertySearchParams({
      minPrice: "9000",
      maxPrice: "100",
      page: "abc",
    }),
    {
      page: 1,
    },
  );
});

test("brochure href uses the public brochure route", () => {
  assert.equal(buildPropertyBrochureHref("eko-atrium-residences"), "/brochures/eko-atrium-residences");
});

test("public property video url is exposed safely when present", () => {
  assert.equal(
    resolvePublicPropertyVideoUrl(" https://cdn.example.com/walkthrough.mp4 "),
    "https://cdn.example.com/walkthrough.mp4",
  );
  assert.equal(resolvePublicPropertyVideoUrl(" "), undefined);
  assert.equal(resolvePublicPropertyVideoUrl(null), undefined);
});

test("public property query exposes multiple SQM land options safely", () => {
  assert.deepEqual(
    normalizePlotOptions([
      { unit: "SQM", label: "350 sqm", sizeSqm: 350, price: 18000000, currency: "NGN", status: "AVAILABLE" },
      { unit: "SQM", label: "400 sqm", sizeSqm: 400, currency: "NGN", status: "AVAILABLE" },
      { unit: "SQM", label: "600 sqm", sizeSqm: 600, price: null },
    ]),
    [
      { unit: "SQM", label: "350 sqm", sizeSqm: 350, price: 18000000, currency: "NGN", status: "AVAILABLE" },
      { unit: "SQM", label: "400 sqm", sizeSqm: 400, currency: "NGN", status: "AVAILABLE" },
      { unit: "SQM", label: "600 sqm", sizeSqm: 600 },
    ],
  );
});
