import test from "node:test";
import assert from "node:assert/strict";
import type { AppRole } from "@prisma/client";

import { buildPublicPropertyWhere } from "@/modules/properties/queries";

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
