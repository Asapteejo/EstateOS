import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDevTenantSiteUrl,
  DEV_ACCESS_PRESETS,
  DEV_ACCESS_ROUTES,
} from "@/components/shared/dev-access";

test("dev access presets keep platform public and onboarding entry distinct", () => {
  const byLabel = Object.fromEntries(
    DEV_ACCESS_PRESETS.map((preset) => [preset.label, preset]),
  );

  assert.equal(byLabel["Public (EstateOS)"]?.href, DEV_ACCESS_ROUTES.platformPublic);
  assert.equal(byLabel["Get Started"]?.href, DEV_ACCESS_ROUTES.onboarding);
  assert.equal(byLabel["Portal"]?.href, DEV_ACCESS_ROUTES.portal);
  assert.equal(byLabel["Admin"]?.href, DEV_ACCESS_ROUTES.admin);
  assert.equal(byLabel["Superadmin"]?.href, DEV_ACCESS_ROUTES.superadmin);
});

test("tenant site url resolves to localhost subdomain in development", () => {
  assert.equal(
    buildDevTenantSiteUrl({
      currentHost: "localhost:3000",
      currentProtocol: "http",
      companySlug: "acme-realty",
    }),
    "http://acme-realty.localhost:3000/",
  );
  assert.equal(
    buildDevTenantSiteUrl({
      currentHost: "localhost:3000",
      currentProtocol: "http",
      companySlug: "acme-realty",
      pathname: "/properties",
    }),
    "http://acme-realty.localhost:3000/properties",
  );
});

test("tenant site url preserves current tenant localhost host when no explicit slug is set", () => {
  assert.equal(
    buildDevTenantSiteUrl({
      currentHost: "acme.localhost:3000",
      currentProtocol: "http",
      companySlug: null,
    }),
    "http://acme.localhost:3000/",
  );
});

test("tenant site url stays unavailable when no tenant slug can be resolved", () => {
  assert.equal(
    buildDevTenantSiteUrl({
      currentHost: "localhost:3000",
      currentProtocol: "http",
      companySlug: null,
    }),
    null,
  );
});
