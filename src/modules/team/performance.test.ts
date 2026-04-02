import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMarketerPerformanceScore,
  buildMarketerStarRating,
} from "@/modules/team/performance";

test("marketer performance score weights reservations and payments above wishlist intent", () => {
  assert.equal(
    buildMarketerPerformanceScore({
      wishlistAdds: 4,
      reservations: 2,
      successfulPayments: 1,
    }),
    15,
  );
});

test("marketer star rating remains credible and bounded", () => {
  assert.equal(buildMarketerStarRating(0), 3);
  assert.equal(buildMarketerStarRating(8), 3.8);
  assert.equal(buildMarketerStarRating(40), 5);
});
