import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCompanyAssignmentAllowed,
  filterSessionRoleAssignments,
} from "@/lib/auth/membership";

test("session roles exclude historical assignments from another tenant", () => {
  assert.deepEqual(
    filterSessionRoleAssignments(
      [
        { companyId: "company-a", role: { companyId: "company-a", name: "ADMIN" } },
        { companyId: "company-b", role: { companyId: "company-b", name: "BUYER" } },
      ],
      "company-b",
    ),
    ["BUYER"],
  );
});

test("session roles allow only global superadmin assignments", () => {
  assert.deepEqual(
    filterSessionRoleAssignments(
      [
        { companyId: null, role: { companyId: null, name: "SUPER_ADMIN" } },
        { companyId: "company-a", role: { companyId: "company-a", name: "SUPER_ADMIN" } },
      ],
      "company-b",
    ),
    ["SUPER_ADMIN"],
  );
});

test("implicit cross-company membership reassignment fails closed", () => {
  assert.doesNotThrow(() => assertCompanyAssignmentAllowed(null, "company-b"));
  assert.doesNotThrow(() => assertCompanyAssignmentAllowed("company-b", "company-b"));
  assert.throws(
    () => assertCompanyAssignmentAllowed("company-a", "company-b"),
    /already belongs to another company/i,
  );
});
