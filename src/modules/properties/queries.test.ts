import test from "node:test";
import assert from "node:assert/strict";
import type { AppRole } from "@prisma/client";

import {
  buildPropertyBrochureHref,
  buildPublicPropertyFilterWhere,
  buildPublicPropertyWhere,
  parsePropertySearchParams,
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

test("public property where clause is tenant-aware", () => {
  assert.deepEqual(buildPublicPropertyWhere(marketingTenant, { slug: "eko-atrium-residences" }), {
    slug: "eko-atrium-residences",
    status: {
      in: ["AVAILABLE", "RESERVED", "SOLD"],
    },
    companyId: "company_1",
  });
});

test("public property where clause filters out draft and archived rows", () => {
  assert.deepEqual(buildPublicPropertyWhere(marketingTenant), {
    status: {
      in: ["AVAILABLE", "RESERVED", "SOLD"],
    },
    companyId: "company_1",
  });
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
    }),
    {
      companyId: "company_1",
      status: {
        in: ["AVAILABLE", "RESERVED", "SOLD"],
      },
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
