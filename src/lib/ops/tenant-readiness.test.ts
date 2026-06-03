import test from "node:test";
import assert from "node:assert/strict";

import { buildTenantReadiness, buildTenantReadinessChecklist } from "@/lib/ops/tenant-readiness";

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
  assert.equal(result.missingItems.includes("Payment account"), true);
  assert.equal(result.missingItems.includes("Paystack platform readiness"), true);
  assert.equal(result.missingItems.includes("Contract settings"), true);
  assert.equal(result.missingItems.includes("Company stamp"), true);
  assert.equal(result.missingItems.includes("Authorized signature"), true);
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

test("custom domain can be intentionally skipped but remains a warning", () => {
  const checklist = buildTenantReadinessChecklist({
    companyExists: true,
    companyActive: true,
    companyProfileComplete: true,
    adminUsers: 1,
    brandingConfigured: true,
    logoConfigured: true,
    propertiesCount: 1,
    paymentAccountConfigured: true,
    paystackConfigured: true,
    contractSettingsConfigured: true,
    stampConfigured: true,
    signatureConfigured: true,
    customDomainConfigured: false,
    customDomainSkipped: true,
    r2Configured: true,
    publicSiteReachable: true,
    walletConfigured: true,
    companyId: "company-1",
  });

  const customDomain = checklist.find((item) => item.id === "custom-domain");
  assert.equal(customDomain?.status, "warning");
  assert.equal(customDomain?.owner, "Superadmin");
  assert.equal(customDomain?.actionLink, "/superadmin/companies/company-1/domains");
});
