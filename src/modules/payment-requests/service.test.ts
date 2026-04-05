import assert from "node:assert/strict";
import test from "node:test";

import { extractTransferInstructions } from "@/lib/payments/paystack";
import { paymentRequestCreateSchema } from "@/lib/validations/payments";
import {
  buildReservationPlaceholderReference,
  derivePaymentRequestStatusFromPayment,
} from "@/modules/payment-requests/service";

test("reservation placeholder references are deterministic and lowercase", () => {
  assert.equal(buildReservationPlaceholderReference("RSV-20260402-1001"), "placeholder-rsv-20260402-1001");
});

test("payment request validation requires a reservation or transaction link", () => {
  const parsed = paymentRequestCreateSchema.safeParse({
    userId: "buyer-1",
    amount: 2500000,
    currency: "NGN",
    title: "Balance payment",
    purpose: "Property balance",
  });

  assert.equal(parsed.success, false);
});

test("paystack transfer instructions mapping reads temporary account details when present", () => {
  const instructions = extractTransferInstructions({
    data: {
      transfer_instruction: {
        bank_name: "Wema Bank",
        account_number: "0123456789",
        account_name: "EstateOS Escrow",
        expires_at: "2026-04-04T12:00:00.000Z",
      },
    },
  });

  assert.deepEqual(instructions, {
    bankName: "Wema Bank",
    accountNumber: "0123456789",
    accountName: "EstateOS Escrow",
    expiresAt: "2026-04-04T12:00:00.000Z",
  });
});

test("payment request reconciliation preserves terminal non-paid states unless webhook success arrives", () => {
  assert.equal(
    derivePaymentRequestStatusFromPayment({
      currentStatus: "CANCELLED",
      paymentStatus: "PENDING",
    }),
    "CANCELLED",
  );
  assert.equal(
    derivePaymentRequestStatusFromPayment({
      currentStatus: "EXPIRED",
      paymentStatus: "PROCESSING",
    }),
    "EXPIRED",
  );
  assert.equal(
    derivePaymentRequestStatusFromPayment({
      currentStatus: "CANCELLED",
      paymentStatus: "SUCCESS",
    }),
    "PAID",
  );
});
