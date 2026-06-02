import { loadEnvConfig } from "@next/env";

import { prisma } from "@/lib/db/prisma";
import {
  BLUEPRINT_COMPANY_SLUG,
  buildRoleIntegrityReport,
  isClearlyDemoUser,
} from "@/lib/ops/data-hygiene";

loadEnvConfig(process.cwd());

async function main() {
  const users = await prisma.user.findMany({
      select: {
        id: true,
        clerkUserId: true,
        email: true,
        companyId: true,
        isActive: true,
        company: { select: { slug: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  const companies = await prisma.company.findMany({
      select: { id: true, name: true, slug: true, status: true },
      orderBy: { createdAt: "asc" },
    });
  const roleAssignments = await prisma.userRole.findMany({
      select: {
        id: true,
        userId: true,
        companyId: true,
        roleId: true,
        role: { select: { name: true, companyId: true } },
        user: {
          select: {
            id: true,
            clerkUserId: true,
            email: true,
            companyId: true,
            isActive: true,
            company: { select: { slug: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  const blueprint = await prisma.company.findUnique({
      where: { slug: BLUEPRINT_COMPANY_SLUG },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        _count: {
          select: {
            users: true,
            userRoles: true,
            properties: true,
            inquiries: true,
            transactions: true,
            paymentRequests: true,
            payments: true,
            documents: true,
            generatedContracts: true,
            kycSubmissions: true,
            testimonials: true,
          },
        },
      },
    });

  const normalizedUsers = users.map((user) => ({
    ...user,
    companySlug: user.company?.slug ?? null,
  }));
  const normalizedRoles = roleAssignments.map((assignment) => ({
    id: assignment.id,
    userId: assignment.userId,
    companyId: assignment.companyId,
    roleId: assignment.roleId,
    roleName: assignment.role.name,
    roleCompanyId: assignment.role.companyId,
    user: {
      ...assignment.user,
      companySlug: assignment.user.company?.slug ?? null,
    },
  }));
  const demoUsers = normalizedUsers.filter(isClearlyDemoUser);
  const demoUserIds = demoUsers.map((user) => user.id);
  const likelyDemoCompanies = companies.filter((company) =>
    company.slug !== BLUEPRINT_COMPANY_SLUG &&
    (
      company.id.startsWith("demo-") ||
      company.slug.startsWith("acme-") ||
      company.slug.startsWith("mock-") ||
      /mock|demo|acme/i.test(company.name)
    ),
  );
  const demoCompanyIds = likelyDemoCompanies.map((company) => company.id);
  const demoRecordCompanyWhere = demoCompanyIds.length > 0
    ? { companyId: { in: demoCompanyIds } }
    : { companyId: { in: [] as string[] } };
  const demoRecordUserWhere = demoUserIds.length > 0
    ? { userId: { in: demoUserIds } }
    : { userId: { in: [] as string[] } };

  const buyerProfiles = await prisma.profile.findMany({
      where: { userId: { in: demoUserIds } },
      select: { id: true, userId: true, profileCompleted: true },
    });
  const inquiries = await prisma.inquiry.findMany({
      where: { OR: [demoRecordUserWhere, demoRecordCompanyWhere] },
      select: { id: true, companyId: true, userId: true, email: true },
    });
  const notifications = await prisma.notification.findMany({
      where: demoRecordUserWhere,
      select: { id: true, companyId: true, userId: true, title: true },
    });
  const properties = await prisma.property.findMany({
      where: demoRecordCompanyWhere,
      select: { id: true, companyId: true, title: true, slug: true, status: true },
    });
  const payments = await prisma.payment.findMany({
      where: {
        OR: [
          { companyId: { in: demoCompanyIds } },
          { userId: { in: demoUserIds } },
        ],
      },
      select: { id: true, companyId: true, userId: true, providerReference: true, status: true },
    });
  const paymentRequests = await prisma.paymentRequest.findMany({
      where: { OR: [demoRecordUserWhere, demoRecordCompanyWhere] },
      select: { id: true, companyId: true, userId: true, status: true, providerReference: true },
    });
  const transactions = await prisma.transaction.findMany({
      where: { OR: [demoRecordUserWhere, demoRecordCompanyWhere] },
      select: { id: true, companyId: true, userId: true, paymentStatus: true },
    });
  const contracts = await prisma.generatedContract.findMany({
      where: {
        OR: [
          { companyId: { in: demoCompanyIds } },
          { buyerUserId: { in: demoUserIds } },
        ],
      },
      select: { id: true, companyId: true, buyerUserId: true, contractNumber: true, documentId: true },
    });
  const documents = await prisma.document.findMany({
      where: {
        OR: [
          { companyId: { in: demoCompanyIds } },
          { userId: { in: demoUserIds } },
          { createdForUserId: { in: demoUserIds } },
        ],
      },
      select: { id: true, companyId: true, userId: true, documentType: true, storageKey: true },
    });
  const kycSubmissions = await prisma.kYCSubmission.findMany({
      where: { OR: [demoRecordUserWhere, demoRecordCompanyWhere] },
      select: { id: true, companyId: true, userId: true, documentId: true, status: true },
    });
  const testimonials = await prisma.testimonial.findMany({
      where: {
        OR: [
          { companyId: { in: demoCompanyIds } },
          { buyerUserId: { in: demoUserIds } },
        ],
      },
      select: { id: true, companyId: true, buyerUserId: true, status: true, displayName: true },
    });

  const integrity = buildRoleIntegrityReport(normalizedRoles, process.env.SUPERADMIN_EMAILS);
  const demoRoles = normalizedRoles.filter((assignment) => demoUserIds.includes(assignment.userId));
  const report = {
    readOnly: true,
    blueprint: {
      preserved: true,
      reason: "Blueprint is explicitly excluded from automatic cleanup suggestions.",
      company: blueprint,
    },
    counts: {
      demoUsers: demoUsers.length,
      likelyDemoCompanies: likelyDemoCompanies.length,
      demoRoles: demoRoles.length,
      buyerProfiles: buyerProfiles.length,
      inquiries: inquiries.length,
      notifications: notifications.length,
      properties: properties.length,
      payments: payments.length,
      paymentRequests: paymentRequests.length,
      transactions: transactions.length,
      contracts: contracts.length,
      documents: documents.length,
      kycSubmissions: kycSubmissions.length,
      testimonials: testimonials.length,
      roleIntegrity: Object.fromEntries(
        Object.entries(integrity).map(([key, rows]) => [key, rows.length]),
      ),
    },
    risk: {
      demoUsers: demoUsers.length > 0 ? "HIGH" : "LOW",
      roleIntegrity: Object.values(integrity).some((rows) => rows.length > 0) ? "CRITICAL" : "LOW",
      blueprint: "PRESERVE",
    },
    records: {
      demoUsers,
      likelyDemoCompanies,
      demoRoles,
      buyerProfiles,
      inquiries,
      notifications,
      properties,
      payments,
      paymentRequests,
      transactions,
      contracts,
      documents,
      kycSubmissions,
      testimonials,
      roleIntegrity: integrity,
    },
  };

  console.log("EstateOS production data-hygiene audit (read-only)");
  console.log(JSON.stringify(report, null, 2));
  console.log("\nSuggested cleanup SQL (manual review only; intentionally commented out):");
  console.log("-- BEGIN;");
  console.log("-- DELETE FROM \"UserRole\" WHERE id IN ('<review-reported-role-ids>');");
  console.log("-- UPDATE \"User\" SET \"isActive\" = false WHERE id IN ('<review-clearly-demo-user-ids>');");
  console.log("-- COMMIT;");
  console.log(`-- Never delete or mutate the ${BLUEPRINT_COMPANY_SLUG} company automatically.`);
  console.log("-- Never delete generated legal documents, KYC documents, payments, or transactions automatically.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
