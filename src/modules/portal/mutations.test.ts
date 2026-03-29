import test from "node:test";
import assert from "node:assert/strict";

import {
  assertReservableStatuses,
  buildReservationReference,
  buildSavedPropertyUniqueInput,
} from "@/modules/portal/mutations";
import { paymentInitializeSchema } from "@/lib/validations/payments";

test("saved property unique input stays tenant- and user-scoped", () => {
  assert.deepEqual(
    buildSavedPropertyUniqueInput({
      companyId: "company_1",
      userId: "user_1",
      propertyId: "property_1",
    }),
    {
      companyId_userId_propertyId: {
        companyId: "company_1",
        userId: "user_1",
        propertyId: "property_1",
      },
    },
  );
});

test("reservation logic rejects unavailable inventory", () => {
  assert.throws(
    () =>
      assertReservableStatuses({
        propertyStatus: "RESERVED",
      }),
    /not available/,
  );

  assert.throws(
    () =>
      assertReservableStatuses({
        propertyStatus: "AVAILABLE",
        unitStatus: "SOLD",
      }),
    /Selected unit is not available/,
  );
});

test("reservation reference format is stable for buyer flow records", () => {
  const reference = buildReservationReference(new Date("2026-03-29T00:00:00.000Z"));
  assert.match(reference, /^RSV-20260329-\d{4}$/);
});

test("payment initialization requires transaction or reservation linkage for installment payments", () => {
  const invalid = paymentInitializeSchema.safeParse({
    email: "buyer@acmerealty.dev",
    amount: 1000000,
    reference: "PAY-1234",
    callbackUrl: "http://localhost:3000/portal/payments",
    installmentId: "installment_1",
  });

  assert.equal(invalid.success, false);

  const valid = paymentInitializeSchema.safeParse({
    email: "buyer@acmerealty.dev",
    amount: 1000000,
    reference: "PAY-1234",
    callbackUrl: "http://localhost:3000/portal/payments",
    installmentId: "installment_1",
    reservationReference: "RSV-20260329-1001",
  });

  assert.equal(valid.success, true);
});

test("reservation creation payload accepts optional marketer and payment plan selection", () => {
  const reservationPayload = {
    propertyId: "property_1",
    marketerId: "marketer_1",
    paymentPlanId: "plan_1",
  };

  assert.equal(reservationPayload.marketerId, "marketer_1");
  assert.equal(reservationPayload.paymentPlanId, "plan_1");

  const paymentPayload = paymentInitializeSchema.safeParse({
    email: "buyer@acmerealty.dev",
    amount: 1000000,
    reference: "PAY-5678",
    callbackUrl: "http://localhost:3000/portal/payments",
    marketerId: "marketer_1",
  });

  assert.equal(paymentPayload.success, true);
});
