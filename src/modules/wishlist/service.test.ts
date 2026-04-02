import test from "node:test";
import assert from "node:assert/strict";

import {
  buildWishlistExpiry,
  buildWishlistTimeLabel,
  buildWishlistWhatsAppHref,
  getWishlistLifecycleState,
  isWishlistReminderEligible,
} from "@/modules/wishlist/service";

test("wishlist expiry is calculated from property duration", () => {
  const savedAt = new Date("2026-04-01T00:00:00.000Z");
  assert.equal(buildWishlistExpiry(savedAt, 10).toISOString(), "2026-04-11T00:00:00.000Z");
});

test("wishlist lifecycle becomes expiring soon near the configured threshold", () => {
  const now = new Date("2026-04-01T00:00:00.000Z");
  assert.equal(
    getWishlistLifecycleState(
      {
        status: "ACTIVE",
        expiresAt: new Date("2026-04-03T00:00:00.000Z"),
      },
      now,
    ),
    "EXPIRING_SOON",
  );
});

test("wishlist reminder eligibility requires active unsent expiring items", () => {
  const now = new Date("2026-04-01T00:00:00.000Z");
  assert.equal(
    isWishlistReminderEligible(
      {
        status: "ACTIVE",
        expiresAt: new Date("2026-04-03T00:00:00.000Z"),
        reminderSentAt: null,
        reminderEnabled: true,
      },
      now,
    ),
    true,
  );
  assert.equal(
    isWishlistReminderEligible(
      {
        status: "ACTIVE",
        expiresAt: new Date("2026-04-03T00:00:00.000Z"),
        reminderSentAt: new Date("2026-04-02T00:00:00.000Z"),
        reminderEnabled: true,
      },
      now,
    ),
    false,
  );
});

test("wishlist whatsapp helper builds a deep link safely", () => {
  assert.match(
    buildWishlistWhatsAppHref({
      phone: "+234 801 222 3333",
      clientName: "Ada",
      propertyTitle: "Eko Atlantic Heights",
    }) ?? "",
    /^https:\/\/wa\.me\/2348012223333\?text=/,
  );
});

test("wishlist time label reports expiry clearly", () => {
  const label = buildWishlistTimeLabel(
    {
      status: "EXPIRING_SOON",
      expiresAt: new Date("2026-04-03T00:00:00.000Z"),
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
    },
    new Date("2026-04-01T00:00:00.000Z"),
  );
  assert.equal(label, "2 days left");
});
