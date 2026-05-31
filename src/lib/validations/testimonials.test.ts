import test from "node:test";
import assert from "node:assert/strict";

import {
  publicTestimonialsFilterSchema,
  testimonialAdminActionSchema,
  testimonialSubmissionSchema,
} from "@/lib/validations/testimonials";

test("buyer testimonial submission accepts safe portal payload", () => {
  const parsed = testimonialSubmissionSchema.parse({
    propertyId: "prop_123",
    rating: 5,
    title: "Clear buying process",
    quote: "The team kept every payment, document, and next step clear throughout the process.",
  });

  assert.equal(parsed.rating, 5);
  assert.equal(parsed.propertyId, "prop_123");
});

test("buyer testimonial submission rejects invalid rating and short quote", () => {
  const parsed = testimonialSubmissionSchema.safeParse({
    rating: 6,
    quote: "Too short",
  });

  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.equal(parsed.error.issues.some((issue) => issue.path.join(".") === "rating"), true);
    assert.equal(parsed.error.issues.some((issue) => issue.path.join(".") === "quote"), true);
  }
});

test("testimonial rejection requires a reason", () => {
  assert.equal(
    testimonialAdminActionSchema.safeParse({ action: "REJECT", rejectionReason: "" }).success,
    false,
  );
  assert.equal(
    testimonialAdminActionSchema.safeParse({ action: "REJECT", rejectionReason: "Please remove private payment details." }).success,
    true,
  );
});

test("public testimonial filters normalize rating year month and search", () => {
  const parsed = publicTestimonialsFilterSchema.parse({
    rating: "5",
    year: "2026",
    month: "5",
    q: "handover",
  });

  assert.equal(parsed.rating, 5);
  assert.equal(parsed.year, 2026);
  assert.equal(parsed.month, 5);
  assert.equal(parsed.q, "handover");
});
