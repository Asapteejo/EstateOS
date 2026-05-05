import type { PaymentProviderCode } from "@prisma/client";

export function buildTenantPaymentProviderAccountWhere(
  companyId: string,
  provider: PaymentProviderCode = "PAYSTACK",
) {
  return {
    companyId,
    provider,
  };
}
