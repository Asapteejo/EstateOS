import test from "node:test";
import assert from "node:assert/strict";

import { isVisibleTeamMemberRecord } from "@/modules/team/queries";

test("marketer profile visibility requires active and published state", () => {
  assert.equal(isVisibleTeamMemberRecord({ isActive: true, isPublished: true }), true);
  assert.equal(isVisibleTeamMemberRecord({ isActive: false, isPublished: true }), false);
  assert.equal(isVisibleTeamMemberRecord({ isActive: true, isPublished: false }), false);
});
