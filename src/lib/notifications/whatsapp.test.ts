import test from "node:test";
import assert from "node:assert/strict";

import {
  buildWhatsAppUsageLogInput,
  getWhatsAppCreditBlockReason,
  normalizeWhatsAppRecipient,
} from "@/lib/notifications/whatsapp";

test("whatsapp recipient normalization produces Twilio addresses", () => {
  assert.equal(normalizeWhatsAppRecipient("+234 801 222 3333"), "whatsapp:+2348012223333");
  assert.equal(normalizeWhatsAppRecipient(""), null);
  assert.equal(normalizeWhatsAppRecipient(null), null);
});

test("whatsapp usage log input records tenant trigger status and provider sid", () => {
  const log = buildWhatsAppUsageLogInput({
    companyId: "company_123",
    trigger: "revenue_recovery.stage_1",
    recipientPhone: "whatsapp:+2348012223333",
    status: "SENT",
    providerSid: "SM123",
    metadata: {
      transactionId: "tx_123",
    },
  });

  assert.deepEqual(log, {
    companyId: "company_123",
    channel: "WHATSAPP",
    trigger: "revenue_recovery.stage_1",
    recipientPhone: "whatsapp:+2348012223333",
    status: "SENT",
    provider: "TWILIO",
    providerSid: "SM123",
    error: null,
    metadata: {
      transactionId: "tx_123",
    },
  });
});

test("whatsapp usage log input records failed attempts with error", () => {
  const log = buildWhatsAppUsageLogInput({
    companyId: "company_123",
    trigger: "revenue_recovery.stage_3",
    recipientPhone: "whatsapp:+2348012223333",
    status: "FAILED",
    error: "Twilio rejected the request.",
  });

  assert.equal(log.channel, "WHATSAPP");
  assert.equal(log.provider, "TWILIO");
  assert.equal(log.status, "FAILED");
  assert.equal(log.providerSid, null);
  assert.equal(log.error, "Twilio rejected the request.");
});

test("whatsapp sending blocks when wallet is empty or blocked", () => {
  assert.equal(getWhatsAppCreditBlockReason({ balance: 0, isBlocked: false }), "blocked_no_credits");
  assert.equal(getWhatsAppCreditBlockReason({ balance: -5, isBlocked: false }), "blocked_no_credits");
  assert.equal(getWhatsAppCreditBlockReason({ balance: 10, isBlocked: true }), "blocked_no_credits");
  assert.equal(getWhatsAppCreditBlockReason({ balance: 1, isBlocked: false }), null);
});
