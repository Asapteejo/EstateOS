import { loadEnvConfig } from "@next/env";

import { prisma } from "@/lib/db/prisma";
import { buildTenantReadiness } from "@/lib/ops/tenant-readiness";

loadEnvConfig(process.cwd());

function readCompanySlug(args: string[]) {
  const index = args.indexOf("--companySlug");
  const slug =
    index >= 0
      ? args[index + 1]
      : args.find((arg) => arg.startsWith("--companySlug="))?.slice("--companySlug=".length);
  if (!slug?.trim()) {
    throw new Error(
      "Usage: npm run audit:tenant-readiness -- --companySlug blueprint-urban-residences",
    );
  }
  return slug.trim().toLowerCase();
}

function hasValues(...values: Array<string | undefined>) {
  return values.every((value) => Boolean(value?.trim()));
}

function absoluteUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

async function main() {
  const companySlug = readCompanySlug(process.argv.slice(2));
  const company = await prisma.company.findUnique({
    where: { slug: companySlug },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      customDomain: true,
      logoUrl: true,
      siteSetting: {
        select: {
          brandingPublishedAt: true,
          publishedBrandingConfig: true,
        },
      },
      contractSettings: {
        select: {
          isConfigured: true,
          stampKey: true,
          signatureKey: true,
        },
      },
      communicationWallet: {
        select: {
          balance: true,
          currency: true,
          isBlocked: true,
          lowBalanceThreshold: true,
        },
      },
      providerAccounts: {
        where: {
          provider: "PAYSTACK",
          status: "ACTIVE",
        },
        select: {
          id: true,
          status: true,
          isDefaultPayout: true,
          supportsTransactionSplit: true,
        },
      },
      users: {
        where: {
          isActive: true,
          roles: {
            some: {
              companyId: { not: null },
              role: {
                name: { in: ["ADMIN", "LEGAL", "FINANCE"] },
              },
            },
          },
        },
        select: {
          id: true,
          email: true,
          clerkUserId: true,
          roles: {
            where: { companyId: { not: null } },
            select: { role: { select: { name: true } } },
          },
        },
      },
      _count: {
        select: {
          properties: true,
          users: true,
          transactions: true,
          paymentRequests: true,
          generatedContracts: true,
          documents: true,
        },
      },
    },
  });

  if (!company) {
    console.log(JSON.stringify({
      companySlug,
      ...buildTenantReadiness({
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
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  const appBaseUrl = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://estateos.tech")
    .replace(/\/+$/, "");
  const publicTenantUrl = company.customDomain
    ? absoluteUrl(company.customDomain)
    : `https://${company.slug}.estateos.tech`;
  const paystackConfigured = hasValues(
    process.env.PAYSTACK_SECRET_KEY,
    process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
    process.env.PAYSTACK_WEBHOOK_SECRET,
  );
  const r2Configured = hasValues(
    process.env.R2_ACCOUNT_ID,
    process.env.R2_ENDPOINT,
    process.env.R2_ACCESS_KEY_ID,
    process.env.R2_SECRET_ACCESS_KEY,
    process.env.R2_BUCKET_NAME,
  );
  const readiness = buildTenantReadiness({
    companyExists: true,
    companyActive: company.status === "ACTIVE",
    adminUsers: company.users.length,
    brandingConfigured: Boolean(
      company.siteSetting?.brandingPublishedAt || company.siteSetting?.publishedBrandingConfig,
    ),
    logoConfigured: Boolean(company.logoUrl),
    propertiesCount: company._count.properties,
    paymentAccountConfigured: company.providerAccounts.length > 0,
    paystackConfigured,
    contractSettingsConfigured: company.contractSettings?.isConfigured === true,
    stampConfigured: Boolean(company.contractSettings?.stampKey),
    signatureConfigured: Boolean(company.contractSettings?.signatureKey),
    r2Configured,
    walletConfigured: Boolean(company.communicationWallet),
  });

  console.log("EstateOS tenant readiness audit (read-only)");
  console.log(JSON.stringify({
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      status: company.status,
    },
    readiness,
    adminUsers: company.users.map((user) => ({
      id: user.id,
      email: user.email,
      clerkLinked: !user.clerkUserId.startsWith("manual:"),
      roles: user.roles.map((assignment) => assignment.role.name),
    })),
    branding: {
      configured: Boolean(
        company.siteSetting?.brandingPublishedAt || company.siteSetting?.publishedBrandingConfig,
      ),
      logoConfigured: Boolean(company.logoUrl),
    },
    inventory: {
      properties: company._count.properties,
      users: company._count.users,
      transactions: company._count.transactions,
      paymentRequests: company._count.paymentRequests,
      generatedContracts: company._count.generatedContracts,
      documents: company._count.documents,
    },
    payments: {
      paystackConfigured,
      paymentAccountConfigured: company.providerAccounts.length > 0,
      accounts: company.providerAccounts,
    },
    contracts: {
      configured: company.contractSettings?.isConfigured === true,
      stampConfigured: Boolean(company.contractSettings?.stampKey),
      signatureConfigured: Boolean(company.contractSettings?.signatureKey),
    },
    storage: {
      r2PrivateDocumentStorageConfigured: r2Configured,
      publicAssetBaseUrlConfigured: Boolean(process.env.R2_PUBLIC_BASE_URL?.trim()),
    },
    wallet: company.communicationWallet ?? {
      configured: false,
      balance: 0,
      currency: "NGN",
    },
    urls: {
      publicTenantSite: publicTenantUrl,
      adminDashboard: `${appBaseUrl}/admin`,
      buyerPortal: `${appBaseUrl}/portal`,
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
