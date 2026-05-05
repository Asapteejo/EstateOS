import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMUNICATION_TOP_UP_TYPE,
  isCommunicationTopUpMetadata,
  normalizeTopUpAmount,
} from "@/modules/communication/topups";

test("communication top-up metadata identifies WhatsApp credit payments", () => {
  assert.equal(
    isCommunicationTopUpMetadata({
      type: COMMUNICATION_TOP_UP_TYPE,
      companyId: "company_1",
      companySlug: "acme",
      creditsExpected: 500,
    }),
    true,
  );
  assert.equal(isCommunicationTopUpMetadata({ type: "TRANSACTION_PAYMENT" }), false);
});

test("communication top-up amount must be positive", () => {
  assert.equal(normalizeTopUpAmount(5000.49), 5000);
  assert.throws(() => normalizeTopUpAmount(0), /greater than zero/);
  assert.throws(() => normalizeTopUpAmount(Number.NaN), /greater than zero/);
});
