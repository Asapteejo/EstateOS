import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAuthCompletionUrl,
  buildAuthRedirect,
  getCentralHosts,
  resolveTenantPublicUrl,
  resolveSafeRedirectUrl,
  resolveTenantSubdomainFromHost,
  sanitizeReturnPath,
  shouldAllowDefaultTenantFallback,
  type DomainRuntimeConfig,
} from "@/lib/domains";

const config: DomainRuntimeConfig = {
  appBaseUrl: "https://estateos.com",
  platformBaseUrl: "https://estateos.com",
  portalBaseUrl: "https://portal.estateos.com",
  isProduction: true,
};

test("central hosts are not treated as tenant subdomains", () => {
  assert.equal(resolveTenantSubdomainFromHost("portal.estateos.com", config), null);
  assert.equal(resolveTenantSubdomainFromHost("estateos.com", config), null);
  assert.deepEqual(Array.from(getCentralHosts(config)).sort(), [
    "estateos.com",
    "portal.estateos.com",
  ]);
});

test("tenant subdomain is extracted only for non-central hosts", () => {
  assert.equal(resolveTenantSubdomainFromHost("acme.estateos.co", config), "acme");
  assert.equal(resolveTenantSubdomainFromHost("acme.localhost:3000", {
    ...config,
    appBaseUrl: "http://localhost:3000",
    platformBaseUrl: "http://localhost:3000",
    portalBaseUrl: "http://localhost:3000",
    isProduction: false,
  }), "acme");
});

test("auth redirect preserves tenant hint and internal return path", () => {
  const redirect = new URL(
    buildAuthRedirect(config, {
      returnTo: "/properties/ikoyi-villas",
      tenantSlug: "acme-realty",
      tenantHost: "myrealty.com",
      entry: "purchase",
    }),
  );

  assert.equal(redirect.origin, "https://portal.estateos.com");
  assert.equal(redirect.pathname, "/sign-in");
  assert.equal(redirect.searchParams.get("tenant"), "acme-realty");
  assert.equal(redirect.searchParams.get("host"), "myrealty.com");
  assert.equal(redirect.searchParams.get("returnTo"), "/properties/ikoyi-villas");
});

test("auth completion URL stays on central portal host", () => {
  const redirect = new URL(
    buildAuthCompletionUrl(config, {
      returnTo: "/admin/payments",
      tenantSlug: "acme-realty",
      entry: "admin",
    }),
  );

  assert.equal(redirect.origin, "https://portal.estateos.com");
  assert.equal(redirect.pathname, "/auth/complete");
  assert.equal(redirect.searchParams.get("returnTo"), "/admin/payments");
});

test("unknown production custom domains do not fall back to default tenant", () => {
  assert.equal(shouldAllowDefaultTenantFallback("myrealty.com", config), false);
  assert.equal(shouldAllowDefaultTenantFallback("portal.estateos.com", config), true);
});

test("redirect sanitization rejects external urls", () => {
  assert.equal(
    resolveSafeRedirectUrl(config, "https://evil.example.com/phish", "/portal"),
    "https://portal.estateos.com/portal",
  );
  assert.equal(
    resolveSafeRedirectUrl(config, "/portal/payments", "/portal"),
    "https://portal.estateos.com/portal/payments",
  );
  assert.equal(sanitizeReturnPath("https://evil.example.com", "/portal"), "/portal");
});

test("development redirect sanitization allows localhost tenant urls", () => {
  const devConfig: DomainRuntimeConfig = {
    appBaseUrl: "http://localhost:3000",
    platformBaseUrl: "http://localhost:3000",
    portalBaseUrl: "http://localhost:3000",
    isProduction: false,
  };

  assert.equal(
    resolveSafeRedirectUrl(devConfig, "http://acme-realty.localhost:3000/", "/"),
    "http://acme-realty.localhost:3000/",
  );
});

test("tenant public urls default to the tenant homepage instead of listings", () => {
  assert.equal(
    resolveTenantPublicUrl(config, {
      customDomain: "myrealty.com",
    }),
    "https://myrealty.com/",
  );
  assert.equal(
    resolveTenantPublicUrl(config, {
      pathname: "/properties",
      customDomain: "myrealty.com",
    }),
    "https://myrealty.com/properties",
  );
});

test("tenant public urls use tenant subdomains when company slug is provided", () => {
  assert.equal(
    resolveTenantPublicUrl(config, {
      companySlug: "acme",
    }),
    "https://acme.estateos.com/",
  );
  assert.equal(
    resolveTenantPublicUrl(config, {
      companySlug: "acme",
      pathname: "/properties",
    }),
    "https://acme.estateos.com/properties",
  );
});

test("tenant public urls use localhost tenant subdomains in development", () => {
  const devConfig: DomainRuntimeConfig = {
    appBaseUrl: "http://localhost:3000",
    platformBaseUrl: "http://localhost:3000",
    portalBaseUrl: "http://localhost:3000",
    isProduction: false,
  };

  assert.equal(
    resolveTenantPublicUrl(devConfig, {
      companySlug: "acme",
    }),
    "http://acme.localhost:3000/",
  );
});
