import test from "node:test";
import assert from "node:assert/strict";

import { buildCompanyPublicSiteUrl } from "@/modules/team/id-card";

test("buildCompanyPublicSiteUrl prefers custom domains", () => {
  assert.equal(
    buildCompanyPublicSiteUrl({
      appBaseUrl: "http://localhost:3000",
      customDomain: "homes.example.com",
    }),
    "https://homes.example.com",
  );
});

test("buildCompanyPublicSiteUrl preserves absolute custom domains", () => {
  assert.equal(
    buildCompanyPublicSiteUrl({
      appBaseUrl: "http://localhost:3000",
      customDomain: "https://homes.example.com",
    }),
    "https://homes.example.com",
  );
});

test("buildCompanyPublicSiteUrl falls back to tenant public route", () => {
  assert.equal(
    buildCompanyPublicSiteUrl({
      appBaseUrl: "http://localhost:3000",
    }),
    "http://localhost:3000/properties",
  );
});
