import assert from "node:assert/strict";
import test from "node:test";

import { assertIncomingIdsBelongToProperty } from "@/modules/properties/mutations";

test("property nested mutation accepts only IDs already owned by the property", () => {
  assert.doesNotThrow(() =>
    assertIncomingIdsBelongToProperty(
      "Property unit",
      ["unit-1", undefined, "unit-2"],
      ["unit-1", "unit-2"],
    ),
  );
});

test("property nested mutation rejects a foreign tenant child ID", () => {
  assert.throws(
    () =>
      assertIncomingIdsBelongToProperty(
        "Property media",
        ["media-owned", "media-foreign"],
        ["media-owned"],
      ),
    /Property media does not belong to this property/,
  );
});
