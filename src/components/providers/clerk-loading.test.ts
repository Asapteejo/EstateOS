import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(...segments: string[]) {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

test("custom tenant public homepage does not initialize Clerk globally", () => {
  const rootLayout = source("src", "app", "layout.tsx");
  const appProviders = source("src", "components", "providers", "app-providers.tsx");
  const rootPage = source("src", "app", "page.tsx");
  const marketingLayout = source("src", "app", "(marketing)", "layout.tsx");

  assert.match(rootLayout, /<AppProviders>/);
  assert.doesNotMatch(appProviders, /ClerkProvider/);
  assert.doesNotMatch(appProviders, /PostHogClerkIdentity/);
  assert.doesNotMatch(rootPage, /AuthProviders|ClerkProvider/);
  assert.doesNotMatch(marketingLayout, /AuthProviders|ClerkProvider/);
});

test("custom tenant auth surfaces redirect centrally before Clerk loads", () => {
  const proxy = source("src", "proxy.ts");

  assert.match(proxy, /isPortalRoute/);
  assert.match(proxy, /isAdminRoute/);
  assert.match(proxy, /isSuperadminRoute/);
  assert.match(proxy, /isSignInRoute/);
  assert.match(proxy, /isSignUpRoute/);
  assert.match(proxy, /!isKnownCentralHost\(req\.headers\.get\("host"\), runtimeConfig\)/);
  assert.match(proxy, /buildAuthRedirect/);
  assert.match(proxy, /tenantHost: req\.nextUrl\.searchParams\.get\("host"\) \?\? req\.headers\.get\("host"\)/);
});

test("central authenticated surfaces still mount the scoped Clerk provider", () => {
  const authProviders = source("src", "components", "providers", "auth-providers.tsx");
  const adminLayout = source("src", "app", "(admin)", "admin", "layout.tsx");
  const portalLayout = source("src", "app", "(portal)", "portal", "layout.tsx");
  const superadminLayout = source("src", "app", "(superadmin)", "superadmin", "layout.tsx");
  const appLayout = source("src", "app", "app", "layout.tsx");
  const signInPage = source("src", "app", "sign-in", "[[...sign-in]]", "page.tsx");
  const signUpPage = source("src", "app", "sign-up", "[[...sign-up]]", "page.tsx");

  assert.match(authProviders, /ClerkProvider/);
  assert.match(adminLayout, /<AuthProviders>/);
  assert.match(portalLayout, /<AuthProviders>/);
  assert.match(superadminLayout, /<AuthProviders>/);
  assert.match(appLayout, /<AuthProviders>/);
  assert.match(signInPage, /<AuthProviders>/);
  assert.match(signUpPage, /<AuthProviders>/);
});
