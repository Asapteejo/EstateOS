import test from "node:test";
import assert from "node:assert/strict";

import { buildPublicTestimonialsWhere, testimonialStatusLabels } from "@/modules/testimonials/service";

test("public testimonial query only returns published non-deleted testimonials", () => {
  const where = buildPublicTestimonialsWhere();

  assert.equal(where.status, "PUBLISHED");
  assert.equal(where.isPublished, true);
  assert.equal(where.deletedAt, null);
});

test("public testimonial query applies archive filters", () => {
  const where = buildPublicTestimonialsWhere({
    rating: 5,
    propertyId: "prop_123",
    year: 2026,
    month: 5,
    q: "handover",
  });

  assert.equal(where.rating, 5);
  assert.equal(where.propertyId, "prop_123");
  assert.deepEqual(where.publishedAt, {
    gte: new Date(Date.UTC(2026, 4, 1)),
    lt: new Date(Date.UTC(2026, 5, 1)),
  });
  assert.equal(Array.isArray(where.OR), true);
});

test("testimonial statuses expose buyer and admin labels", () => {
  assert.equal(testimonialStatusLabels.PENDING_REVIEW, "Pending review");
  assert.equal(testimonialStatusLabels.PUBLISHED, "Published");
  assert.equal(testimonialStatusLabels.REJECTED, "Rejected");
});
