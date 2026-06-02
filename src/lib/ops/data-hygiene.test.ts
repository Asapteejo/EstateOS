import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  BLUEPRINT_COMPANY_SLUG,
  buildCleanupPlan,
  parseCleanupMode,
  type HygieneRoleAssignment,
  type HygieneUser,
} from "@/lib/ops/data-hygiene";

const demoUser: HygieneUser = {
  id: "demo-user",
  clerkUserId: "demo-superadmin",
  email: "superadmin@estateos.dev",
  companyId: null,
};

function assignment(overrides: Partial<HygieneRoleAssignment> = {}): HygieneRoleAssignment {
  return {
    id: "role-assignment",
    userId: demoUser.id,
    companyId: null,
    roleId: "role-superadmin",
    roleName: "SUPER_ADMIN",
    roleCompanyId: null,
    user: demoUser,
    ...overrides,
  };
}

test("data hygiene audit script remains read-only", () => {
  const source = readFileSync("scripts/audit-data-hygiene.ts", "utf8");

  assert.doesNotMatch(source, /\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\(/);
  assert.match(source, /readOnly: true/);
});

test("cleanup defaults to dry-run and requires exact confirmation for apply", () => {
  assert.deepEqual(parseCleanupMode([]), { apply: false, confirmation: null });
  assert.throws(() => parseCleanupMode(["--apply"]), /requires --confirm/);
  assert.throws(
    () => parseCleanupMode(["--apply", "--confirm", "wrong"]),
    /requires --confirm/,
  );
  assert.equal(
    parseCleanupMode(["--apply", "--confirm", "CLEAN_DEMO_DATA"]).apply,
    true,
  );
});

test("Blueprint users and role assignments are never selected for cleanup", () => {
  const blueprintUser = {
    ...demoUser,
    id: "blueprint-demo-user",
    companyId: "blueprint-company",
    companySlug: BLUEPRINT_COMPANY_SLUG,
  };
  const plan = buildCleanupPlan(
    [assignment({ id: "blueprint-role", userId: blueprintUser.id, user: blueprintUser })],
    [blueprintUser],
    "owner@example.com",
  );

  assert.deepEqual(plan, { roleAssignments: [], deactivateUsers: [] });
});

test("unauthorized global superadmin assignment is selected conservatively", () => {
  const plan = buildCleanupPlan(
    [assignment()],
    [demoUser],
    "owner@example.com",
  );

  assert.deepEqual(plan.roleAssignments, [{
    id: "role-assignment",
    reasons: ["demo-user-role", "unauthorized-global-superadmin"],
  }]);
  assert.equal(plan.deactivateUsers[0]?.id, demoUser.id);
});
