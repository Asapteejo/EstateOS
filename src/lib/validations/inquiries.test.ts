import test from "node:test";
import assert from "node:assert/strict";

import {
  inquirySchema,
  inquiryUpdateSchema,
  inspectionSchema,
  inspectionUpdateSchema,
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
