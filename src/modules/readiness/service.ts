import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { isCustomDomainIntentionallySkipped } from "@/lib/domains/custom-domain";
import { featureFlags } from "@/lib/env";
import {
  buildTenantReadiness,
  buildTenantReadinessChecklist,
  type TenantReadinessInput,
} from "@/lib/ops/tenant-readiness";

const companyReadinessSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  legalName: true,
  logoUrl: true,
  customDomain: true,
  customDomainStatus: true,
  brandSettings: true,
  providerAccounts: {
    where: {
      provider: "PAYSTACK",
      status: "ACTIVE",
    },
    select: {
      id: true,
      provider: true,
      status: true,
      displayName: true,
      subaccountCode: true,
      supportsTransactionSplit: true,
      isDefaultPayout: true,
    },
    take: 5,
  },
  siteSetting: {
    select: {
      companyName: true,
      supportEmail: true,
      address: true,
      brandingPublishedAt: true,
      publishedBrandingConfig: true,
    },
  },
  contractSettings: {
    select: {
      ceoName: true,
      ceoTitle: true,
      isConfigured: true,
      stampKey: true,
      signatureKey: true,
      contractTerms: true,
      footerLegalText: true,
    },
  },
  users: {
    where: {
      isActive: true,
      roles: {
        some: {
          companyId: undefined,
          role: { name: { in: ["ADMIN", "LEGAL", "FINANCE", "STAFF"] } },
        },
      },
    },
    select: { id: true },
    take: 10,
  },
  _count: {
    select: {
      properties: true,
    },
  },
} satisfies Prisma.CompanySelect;

type CompanyReadinessRecord = Prisma.CompanyGetPayload<{ select: typeof companyReadinessSelect }>;

export async function getTenantReadinessForCompany(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      ...companyReadinessSelect,
      users: {
        where: {
          isActive: true,
          roles: {
            some: {
              companyId,
              role: { name: { in: ["ADMIN", "LEGAL", "FINANCE", "STAFF"] } },
            },
          },
        },
        select: { id: true },
        take: 10,
      },
    },
  }) as CompanyReadinessRecord | null;

  if (!company) {
    const input: TenantReadinessInput = {
      companyExists: false,
      companyActive: false,
      companyProfileComplete: false,
      adminUsers: 0,
      brandingConfigured: false,
      logoConfigured: false,
      propertiesCount: 0,
      paymentAccountConfigured: false,
      paystackConfigured: featureFlags.hasPaystack,
      contractSettingsConfigured: false,
      stampConfigured: false,
      signatureConfigured: false,
      customDomainConfigured: false,
      customDomainSkipped: false,
      r2Configured: featureFlags.hasR2,
      publicSiteReachable: false,
      walletConfigured: false,
      companyId,
    };
    return {
      company: null,
      input,
      summary: buildTenantReadiness(input),
      checklist: buildTenantReadinessChecklist(input),
      visibility: null,
    };
  }

  const publishedBranding =
    company.siteSetting?.publishedBrandingConfig &&
    typeof company.siteSetting.publishedBrandingConfig === "object" &&
    !Array.isArray(company.siteSetting.publishedBrandingConfig)
      ? company.siteSetting.publishedBrandingConfig as Record<string, unknown>
      : {};
  const logoConfigured = Boolean(company.logoUrl || publishedBranding.logoUrl);
  const brandingConfigured = Boolean(company.siteSetting?.brandingPublishedAt || company.siteSetting?.publishedBrandingConfig);
  const paymentAccountConfigured = company.providerAccounts.some((account) => Boolean(account.subaccountCode));
  const customDomainConfigured = Boolean(company.customDomain && company.customDomainStatus === "VERIFIED");
  const customDomainSkipped = isCustomDomainIntentionallySkipped(company.brandSettings);
  const companyProfileComplete = Boolean(
    company.status === "ACTIVE" &&
    (company.legalName || company.siteSetting?.companyName || company.name) &&
    company.siteSetting?.supportEmail,
  );
  const publicSiteReachable = company.status === "ACTIVE" && company._count.properties > 0;

  const input: TenantReadinessInput = {
    companyExists: true,
    companyActive: company.status === "ACTIVE",
    companyProfileComplete,
    adminUsers: company.users.length,
    brandingConfigured,
    logoConfigured,
    faviconConfigured: Boolean(publishedBranding.faviconUrl),
    heroConfigured: Boolean(publishedBranding.heroImageUrl),
    propertiesCount: company._count.properties,
    paymentAccountConfigured,
    paystackConfigured: featureFlags.hasPaystack,
    contractSettingsConfigured: company.contractSettings?.isConfigured === true,
    stampConfigured: Boolean(company.contractSettings?.stampKey),
    signatureConfigured: Boolean(company.contractSettings?.signatureKey),
    customDomainConfigured,
    customDomainSkipped,
    r2Configured: featureFlags.hasR2,
    publicSiteReachable,
    walletConfigured: true,
    companyId,
  };

  return {
    company,
    input,
    summary: buildTenantReadiness(input),
    checklist: buildTenantReadinessChecklist(input),
    visibility: {
      branding: {
        logoConfigured,
        faviconConfigured: Boolean(publishedBranding.faviconUrl),
        heroConfigured: Boolean(publishedBranding.heroImageUrl),
        published: brandingConfigured,
      },
      payments: {
        paystackPlatformReady: featureFlags.hasPaystack,
        providerAccounts: company.providerAccounts,
        payoutReady: paymentAccountConfigured,
      },
      contracts: {
        settingsConfigured: company.contractSettings?.isConfigured === true,
        stampConfigured: Boolean(company.contractSettings?.stampKey),
        signatureConfigured: Boolean(company.contractSettings?.signatureKey),
      },
    },
  };
}
