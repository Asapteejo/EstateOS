import test from "node:test";
import assert from "node:assert/strict";

import {
  savedPropertyMutationSchema,
  wishlistFollowUpMutationSchema,
} from "@/lib/validations/saved-properties";

test("saved property mutation accepts marketer selection", () => {
  const parsed = savedPropertyMutationSchema.parse({
    propertyId: "property-1",
    marketerId: "marketer-1",
  });

  assert.equal(parsed.marketerId, "marketer-1");
});

test("wishlist follow-up schema limits statuses to supported workflow values", () => {
  const parsed = wishlistFollowUpMutationSchema.parse({
    followUpStatus: "CONTACTED",
    followUpNote: "Client responded on WhatsApp.",
  });

  assert.equal(parsed.followUpStatus, "CONTACTED");
  assert.throws(
    () =>
      wishlistFollowUpMutationSchema.parse({
        followUpStatus: "UNKNOWN",
      }),
  );
});
