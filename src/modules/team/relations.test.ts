import assert from "node:assert/strict";
import test from "node:test";

import { findMatchingStaffProfileId } from "@/modules/team/relations";

test("staff profile relation prefers an unambiguous email match", () => {
  const matched = findMatchingStaffProfileId(
    {
      email: "agent@estateos.dev",
      staffCode: "STAFF-9",
    },
    [
      {
        id: "staff_1",
        teamMemberId: null,
        staffCode: null,
        user: { email: "agent@estateos.dev" },
      },
      {
        id: "staff_2",
        teamMemberId: null,
        staffCode: "STAFF-9",
        user: { email: "other@estateos.dev" },
      },
    ],
  );

  assert.equal(matched, "staff_1");
});

test("staff profile relation falls back to staff code when email does not match", () => {
  const matched = findMatchingStaffProfileId(
    {
      email: "nomatch@estateos.dev",
      staffCode: "STAFF-22",
    },
    [
      {
        id: "staff_1",
        teamMemberId: null,
        staffCode: "STAFF-22",
        user: { email: "other@estateos.dev" },
      },
    ],
  );

  assert.equal(matched, "staff_1");
});

test("staff profile relation rejects ambiguous email candidates", () => {
  const matched = findMatchingStaffProfileId(
    {
      email: "shared@estateos.dev",
      staffCode: null,
    },
    [
      {
        id: "staff_1",
        teamMemberId: null,
        staffCode: null,
        user: { email: "shared@estateos.dev" },
      },
      {
        id: "staff_2",
        teamMemberId: null,
        staffCode: null,
        user: { email: "shared@estateos.dev" },
      },
    ],
  );

  assert.equal(matched, null);
});
