import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMailtoHref,
  buildWhatsAppHref,
  sanitizeWhatsAppNumber,
} from "@/modules/team/contact";

test("sanitizeWhatsAppNumber strips formatting but keeps digits", () => {
  assert.equal(sanitizeWhatsAppNumber("+234 801-222-3333"), "2348012223333");
});

test("buildWhatsAppHref returns null when number is missing", () => {
  assert.equal(buildWhatsAppHref(""), null);
  assert.equal(buildWhatsAppHref(undefined), null);
});

test("buildMailtoHref only returns valid mailto links", () => {
  assert.equal(buildMailtoHref("agent@example.com"), "mailto:agent@example.com");
  assert.equal(buildMailtoHref("invalid-email"), null);
});
