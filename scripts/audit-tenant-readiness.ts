import { loadEnvConfig } from "@next/env";

import { prisma } from "@/lib/db/prisma";
import { getTenantReadinessForCompany } from "@/modules/readiness/service";

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
      customDomainStatus: true,
      communicationWallet: {
        select: {
          balance: true,
          currency: true,
          isBlocked: true,
          lowBalanceThreshold: true,
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
      status: "Not ready",
      missingItems: ["Company profile"],
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  const appBaseUrl = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://estateos.tech")
    .replace(/\/+$/, "");
  const publicTenantUrl = company.customDomain
    ? absoluteUrl(company.customDomain)
    : `https://${company.slug}.estateos.tech`;
  const readiness = await getTenantReadinessForCompany(company.id);

  console.log("EstateOS tenant readiness audit (read-only)");
  console.log(JSON.stringify({
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      status: company.status,
      customDomain: company.customDomain,
      customDomainStatus: company.customDomainStatus,
    },
    readiness: readiness.summary,
    checklist: readiness.checklist.map((item) => ({
      item: item.label,
      status: item.status,
      owner: item.owner,
      actionLink: item.actionLink,
      explanation: item.explanation,
    })),
    adminUsers: company.users.map((user) => ({
      id: user.id,
      email: user.email,
      clerkLinked: !user.clerkUserId.startsWith("manual:"),
      roles: user.roles.map((assignment) => assignment.role.name),
    })),
    visibility: readiness.visibility,
    inventory: {
      properties: company._count.properties,
      users: company._count.users,
      transactions: company._count.transactions,
      paymentRequests: company._count.paymentRequests,
      generatedContracts: company._count.generatedContracts,
      documents: company._count.documents,
    },
    storage: {
      r2PrivateDocumentStorageConfigured: readiness.input.r2Configured,
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
