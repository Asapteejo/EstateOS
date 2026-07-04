import test from "node:test";
import assert from "node:assert/strict";

import {
  isThreadUnreadForBuyer,
  isThreadUnreadForTeam,
  makePreview,
} from "@/modules/messaging/service";

test("makePreview collapses whitespace and leaves short messages intact", () => {
  assert.equal(makePreview("  Hello   world \n team "), "Hello world team");
});

test("makePreview truncates messages longer than 90 characters with an ellipsis", () => {
  const preview = makePreview("a".repeat(200));
  assert.equal(preview.length, 90);
  assert.ok(preview.endsWith("…"));
});

test("buyer thread is unread when the team sent the last message and the buyer hasn't opened it", () => {
  assert.equal(
    isThreadUnreadForBuyer({
      lastMessageSenderRole: "TEAM",
      lastMessageAt: new Date("2026-07-02T12:00:00.000Z"),
      buyerLastReadAt: null,
    }),
    true,
  );
});

test("buyer thread is read once the buyer opened it after the last team message", () => {
  assert.equal(
    isThreadUnreadForBuyer({
      lastMessageSenderRole: "TEAM",
      lastMessageAt: new Date("2026-07-02T12:00:00.000Z"),
      buyerLastReadAt: new Date("2026-07-02T12:05:00.000Z"),
    }),
    false,
  );
});

test("buyer thread is not unread when the buyer themselves sent the last message", () => {
  assert.equal(
    isThreadUnreadForBuyer({
      lastMessageSenderRole: "BUYER",
      lastMessageAt: new Date("2026-07-02T12:00:00.000Z"),
      buyerLastReadAt: null,
    }),
    false,
  );
});

test("buyer thread becomes unread again when a newer team message arrives after the last read", () => {
  assert.equal(
    isThreadUnreadForBuyer({
      lastMessageSenderRole: "TEAM",
      lastMessageAt: new Date("2026-07-02T13:00:00.000Z"),
      buyerLastReadAt: new Date("2026-07-02T12:00:00.000Z"),
    }),
    true,
  );
});

test("team thread is unread when the buyer sent the last message and no team member has opened it", () => {
  assert.equal(
    isThreadUnreadForTeam({
      lastMessageSenderRole: "BUYER",
      lastMessageAt: new Date("2026-07-02T12:00:00.000Z"),
      teamLastReadAt: null,
    }),
    true,
  );
});

test("team thread is read after a team member opens it and is never unread for the team's own replies", () => {
  assert.equal(
    isThreadUnreadForTeam({
      lastMessageSenderRole: "BUYER",
      lastMessageAt: new Date("2026-07-02T12:00:00.000Z"),
      teamLastReadAt: new Date("2026-07-02T12:01:00.000Z"),
    }),
    false,
  );
  assert.equal(
    isThreadUnreadForTeam({
      lastMessageSenderRole: "TEAM",
      lastMessageAt: new Date("2026-07-02T12:00:00.000Z"),
      teamLastReadAt: null,
    }),
    false,
  );
});

test("a thread with no tracked last-sender is not unread for either side", () => {
  const base = { lastMessageAt: new Date(), buyerLastReadAt: null, teamLastReadAt: null };
  assert.equal(isThreadUnreadForBuyer({ ...base, lastMessageSenderRole: null }), false);
  assert.equal(isThreadUnreadForTeam({ ...base, lastMessageSenderRole: null }), false);
});
