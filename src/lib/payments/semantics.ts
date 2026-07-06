import type { PaymentStatus } from "@prisma/client";

export const PAYMENT_INSTALLMENT_RULE =
  "An installment may receive multiple payments over time, but each payment may reference at most one installment.";

export function assertInstallmentMatchesCompany(
  companyId: string,
  installmentCompanyId?: string | null,
) {
  if (!installmentCompanyId || installmentCompanyId !== companyId) {
    throw new Error("Installment does not belong to the resolved tenant.");
  }

  return true;
}

export function assertInstallmentMatchesTransaction(
  transactionPropertyId?: string | null,
  installmentPropertyId?: string | null,
) {
  if (
    transactionPropertyId &&
    installmentPropertyId &&
    transactionPropertyId !== installmentPropertyId
  ) {
    throw new Error("Installment does not belong to the transaction property.");
  }

  return true;
}

export function selectTenantOwnedRelationId(
  companyId: string,
  record?: { id: string; companyId: string } | null,
) {
  return record?.companyId === companyId ? record.id : undefined;
}

export function buildPaystackWebhookEventId(input: {
  event: string;
  providerId?: string | number | null;
  reference: string;
}) {
  return `${input.event}:${input.providerId ?? input.reference}`;
}

/**
 * Idempotency rules for webhook status transitions:
 *  - Never downgrade: once SUCCESS, later FAILED events cannot unwind it.
 *  - Money mutations run only on the FIRST transition into SUCCESS, so a
 *    second success event for the same reference (different provider event
 *    id, or a concurrent duplicate) can never double-decrement a balance.
 */
export function resolveReconciliationStatus(input: {
  previousStatus: PaymentStatus | null;
  incomingStatus: PaymentStatus;
}) {
  const status: PaymentStatus =
    input.previousStatus === "SUCCESS" ? "SUCCESS" : input.incomingStatus;
  return {
    status,
    isFirstSuccessfulReconciliation:
      status === "SUCCESS" && input.previousStatus !== "SUCCESS",
  };
}
