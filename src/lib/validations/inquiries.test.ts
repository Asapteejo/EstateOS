import test from "node:test";
import assert from "node:assert/strict";

import {
  inquirySchema,
  inquiryReplySchema,
  inquiryUpdateSchema,
  inspectionSchema,
  inspectionUpdateSchema,
  portalInquirySchema,
} from "@/lib/validations/inquiries";

test("inquiry payload supports tenant-safe public submission", () => {
  const parsed = inquirySchema.parse({
    propertyId: "prop_123",
    fullName: "Ada Okafor",
    email: "ada@example.com",
    message: "I want to know the payment structure and availability.",
  });

  assert.equal(parsed.fullName, "Ada Okafor");
});

test("portal inquiry payload does not require public visitor identity fields", () => {
  const parsed = portalInquirySchema.parse({
    category: "PAYMENT_STEPS",
    message: "Please explain the next payment step for my reservation.",
  });

  assert.equal(parsed.category, "PAYMENT_STEPS");
  assert.equal(parsed.message, "Please explain the next payment step for my reservation.");
});

test("portal inquiry payload returns useful issue for missing message", () => {
  const parsed = portalInquirySchema.safeParse({
    category: "PAYMENT_STEPS",
    message: "",
  });

  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.equal(parsed.error.issues[0]?.path.join("."), "message");
  }
});

test("inspection payload accepts browser datetime-local values", () => {
  const parsed = inspectionSchema.parse({
    propertyId: "prop_123",
    fullName: "Ada Okafor",
    email: "ada@example.com",
    phone: "+2348012345678",
    scheduledFor: "2026-04-02T10:30",
  });

  assert.equal(parsed.propertyId, "prop_123");
});

test("admin inquiry and inspection updates require known workflow statuses", () => {
  assert.equal(
    inquiryUpdateSchema.safeParse({ status: "CONTACTED", assignedStaffId: null }).success,
    true,
  );
  assert.equal(
    inspectionUpdateSchema.safeParse({ status: "RESCHEDULED", scheduledFor: "2026-04-02T10:30" }).success,
    true,
  );
});

test("admin inquiry reply requires a buyer-readable message", () => {
  assert.equal(inquiryReplySchema.safeParse({ message: "Thanks, we will confirm availability shortly." }).success, true);

  const parsed = inquiryReplySchema.safeParse({ message: "Too short" });
  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.equal(parsed.error.issues[0]?.path.join("."), "message");
  }
});
