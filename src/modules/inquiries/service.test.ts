import test from "node:test";
import assert from "node:assert/strict";

import { buildPortalInquiryMessage, canTransitionInquiryStatus } from "@/modules/inquiries/service";

test("inquiry transitions allow operational progression", () => {
  assert.equal(canTransitionInquiryStatus("NEW", "CONTACTED"), true);
  assert.equal(canTransitionInquiryStatus("CONTACTED", "INSPECTION_BOOKED"), true);
  assert.equal(canTransitionInquiryStatus("QUALIFIED", "CONVERTED"), true);
});

test("inquiry transitions block reopening closed or lost records", () => {
  assert.equal(canTransitionInquiryStatus("CLOSED", "NEW"), false);
  assert.equal(canTransitionInquiryStatus("LOST", "CONTACTED"), false);
});

test("portal inquiry message preserves category context for tenant queue", () => {
  assert.equal(
    buildPortalInquiryMessage({
      category: "AVAILABILITY",
      message: "Is the three bedroom unit still available?",
    }),
    "[Portal inquiry - Availability]\n\nIs the three bedroom unit still available?",
  );
});
