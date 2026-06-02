import test from "node:test";
import assert from "node:assert/strict";

import { buildTenantReadiness } from "@/lib/ops/tenant-readiness";

test("tenant readiness reports missing Paystack and contract settings clearly", () => {
  const result = buildTenantReadiness({
    companyExists: true,
    companyActive: true,
    adminUsers: 1,
    brandingConfigured: true,
    logoConfigured: true,
    propertiesCount: 2,
    paymentAccountConfigured: false,
    paystackConfigured: false,
    contractSettingsConfigured: false,
    stampConfigured: false,
    signatureConfigured: false,
    r2Configured: true,
    walletConfigured: true,
  });

  assert.equal(result.status, "Partially ready");
  assert.equal(result.missingItems.includes("Paystack live configuration"), true);
  assert.equal(result.missingItems.includes("contract settings"), true);
  assert.equal(result.missingItems.includes("company stamp"), true);
  assert.equal(result.missingItems.includes("authorized signature"), true);
});

test("tenant readiness reports unknown company as not ready", () => {
  assert.deepEqual(
    buildTenantReadiness({
      companyExists: false,
      companyActive: false,
      adminUsers: 0,
      brandingConfigured: false,
      logoConfigured: false,
      propertiesCount: 0,
      paymentAccountConfigured: false,
      paystackConfigured: false,
      contractSettingsConfigured: false,
      stampConfigured: false,
      signatureConfigured: false,
      r2Configured: false,
      walletConfigured: false,
    }),
    {
      status: "Not ready",
      missingItems: ["company"],
    },
  );
});
