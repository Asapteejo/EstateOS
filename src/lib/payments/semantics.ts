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

export function buildPaystackWebhookEventId(input: {
  event: string;
  providerId?: string | number | null;
  reference: string;
}) {
  return `${input.event}:${input.providerId ?? input.reference}`;
}
