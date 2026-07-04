import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

test("tenant site url uses devTenant query on localhost in development", () => {
  assert.equal(
    buildDevTenantSiteUrl({
      currentHost: "localhost:3000",
      currentProtocol: "http",
      companySlug: "acme-realty",
    }),
    "http://localhost:3000/?devTenant=acme-realty",
  );
  assert.equal(
    buildDevTenantSiteUrl({
      currentHost: "localhost:3000",
      currentProtocol: "http",
      companySlug: "acme-realty",
      pathname: "/properties",
    }),
    "http://localhost:3000/properties?devTenant=acme-realty",
  );
});

test("tenant site url converts localhost subdomain to devTenant query", () => {
  assert.equal(
    buildDevTenantSiteUrl({
      currentHost: "acme.localhost:3000",
      currentProtocol: "http",
      companySlug: null,
    }),
    "http://localhost:3000/?devTenant=acme",
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

test("devTenant query is forwarded and consumed only for dev tenant resolution", () => {
  const proxySource = readFileSync(join(process.cwd(), "src", "proxy.ts"), "utf8");
  const contextSource = readFileSync(join(process.cwd(), "src", "lib", "tenancy", "context.ts"), "utf8");

  assert.match(proxySource, /req\.nextUrl\.searchParams\.get\("devTenant"\)/);
  assert.match(proxySource, /featureFlags\.devAccessMode && devTenant/);
  assert.match(proxySource, /requestHeaders\.set\("x-estateos-dev-tenant", sanitizedDevTenant\)/);
  assert.match(contextSource, /featureFlags\.allowDevBypass/);
  assert.match(contextSource, /requestHeaders\.get\("x-estateos-dev-tenant"\)/);
  assert.match(contextSource, /area === "marketing" && devTenantSlug/);
  assert.match(contextSource, /area !== "marketing" && tenantHintSlug/);
});
