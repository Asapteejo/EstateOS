import assert from "node:assert/strict";
import test from "node:test";

import { DEV_ACCESS_PRESETS, DEV_ACCESS_ROUTES } from "@/components/shared/dev-access";

test("dev access presets keep platform public, tenant site, and properties distinct", () => {
  const byLabel = Object.fromEntries(
    DEV_ACCESS_PRESETS.map((preset) => [preset.label, preset]),
  );

  assert.equal(byLabel["Public (EstateOS)"]?.href, DEV_ACCESS_ROUTES.platformPublic);
  assert.equal(byLabel["Tenant Site"]?.href, DEV_ACCESS_ROUTES.tenantHome);
  assert.equal(byLabel["Properties"]?.href, DEV_ACCESS_ROUTES.tenantProperties);
  assert.equal(byLabel["Portal"]?.href, DEV_ACCESS_ROUTES.portal);
  assert.equal(byLabel["Admin"]?.href, DEV_ACCESS_ROUTES.admin);
  assert.equal(byLabel["Superadmin"]?.href, DEV_ACCESS_ROUTES.superadmin);
});

test("tenant public targets do not collapse into the same route", () => {
  assert.notEqual(DEV_ACCESS_ROUTES.platformPublic, DEV_ACCESS_ROUTES.tenantHome);
  assert.notEqual(DEV_ACCESS_ROUTES.tenantHome, DEV_ACCESS_ROUTES.tenantProperties);
});
