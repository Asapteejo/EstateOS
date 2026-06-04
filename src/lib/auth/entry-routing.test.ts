import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(...segments: string[]) {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

test("auth completion fails closed for tenant entry hints that cannot resolve a tenant", () => {
  const route = source("src", "app", "auth", "complete", "route.ts");

  assert.match(route, /tenantEntry && \(resolvedTenant \|\| tenantHost \|\| tenantSlug\)/);
  assert.match(route, /const canAccessEntry = resolvedTenant/);
  assert.match(route, /: false/);
  assert.match(route, /return NextResponse\.redirect\([\s\S]*buildTenantAccessUrl/);
});

test("portal session guard requires buyer role before rendering portal content", () => {
  const guards = source("src", "lib", "auth", "guards.ts");

  assert.match(guards, /export async function requirePortalSession/);
  assert.match(guards, /hasRequiredRole\(session\.roles, \["BUYER"\]\)/);
  assert.match(guards, /redirect\("\/superadmin"\)/);
  assert.match(guards, /redirect\("\/admin"\)/);
  assert.match(guards, /return requirePortalSession\(options\)/);
});
