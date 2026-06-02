export type TenantReadinessInput = {
  companyExists: boolean;
  companyActive: boolean;
  adminUsers: number;
  brandingConfigured: boolean;
  logoConfigured: boolean;
  propertiesCount: number;
  paymentAccountConfigured: boolean;
  paystackConfigured: boolean;
  contractSettingsConfigured: boolean;
  stampConfigured: boolean;
  signatureConfigured: boolean;
  r2Configured: boolean;
  walletConfigured: boolean;
};

export function buildTenantReadiness(input: TenantReadinessInput) {
  if (!input.companyExists) {
    return {
      status: "Not ready" as const,
      missingItems: ["company"],
    };
  }

  const checks = [
    ["active company status", input.companyActive],
    ["tenant admin user", input.adminUsers > 0],
    ["published branding", input.brandingConfigured],
    ["company logo", input.logoConfigured],
    ["property inventory", input.propertiesCount > 0],
    ["payment account", input.paymentAccountConfigured],
    ["Paystack live configuration", input.paystackConfigured],
    ["contract settings", input.contractSettingsConfigured],
    ["company stamp", input.stampConfigured],
    ["authorized signature", input.signatureConfigured],
    ["R2 private document storage", input.r2Configured],
  ] as const;
  const missingItems = checks.filter(([, ready]) => !ready).map(([label]) => label);

  return {
    status: missingItems.length === 0 ? "Ready" as const : "Partially ready" as const,
    missingItems,
    warnings: input.walletConfigured ? [] : ["WhatsApp communication wallet is not initialized."],
  };
}
