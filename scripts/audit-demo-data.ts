import { PrismaClient } from "@prisma/client";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
const prisma = new PrismaClient();

async function main() {
  const [
    demoUsers,
    likelyDemoCompanies,
    demoRoles,
    demoInquiries,
    sampleListings,
    samplePayments,
    sampleContracts,
  ] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { clerkUserId: { startsWith: "demo-" } },
          { clerkUserId: { startsWith: "mock:" } },
          { clerkUserId: { startsWith: "sample-" } },
          { email: { endsWith: "@acmerealty.dev" } },
          { email: { endsWith: "@estateos.dev" } },
          { email: { endsWith: "@estateos.test" } },
        ],
      },
      select: { id: true, clerkUserId: true, email: true, companyId: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.company.findMany({
      where: {
        OR: [
          { id: { startsWith: "demo-" } },
          { slug: { startsWith: "acme-" } },
          { slug: { startsWith: "mock-" } },
          { name: { contains: "Mock", mode: "insensitive" } },
          { name: { contains: "Acme", mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, slug: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.userRole.findMany({
      where: {
        user: {
          OR: [
            { clerkUserId: { startsWith: "demo-" } },
            { clerkUserId: { startsWith: "mock:" } },
            { clerkUserId: { startsWith: "sample-" } },
          ],
        },
      },
      select: {
        id: true,
        companyId: true,
        role: { select: { name: true } },
        user: { select: { id: true, clerkUserId: true, email: true } },
      },
    }),
    prisma.inquiry.findMany({
      where: {
        OR: [
          { email: { endsWith: "@acmerealty.dev" } },
          { email: { endsWith: "@estateos.test" } },
          { message: { contains: "SIMULATED TEST", mode: "insensitive" } },
        ],
      },
      select: { id: true, companyId: true, email: true },
    }),
    prisma.property.findMany({
      where: {
        OR: [
          { slug: { startsWith: "mock-" } },
          { description: { contains: "sample", mode: "insensitive" } },
          { shortDescription: { contains: "sample", mode: "insensitive" } },
        ],
      },
      select: { id: true, companyId: true, title: true, slug: true },
    }),
    prisma.payment.findMany({
      where: {
        OR: [
          { providerReference: { startsWith: "PAY-SAMPLE-" } },
          { providerReference: { startsWith: "SIMULATED-" } },
          { providerReference: { startsWith: "placeholder-" } },
        ],
      },
      select: { id: true, companyId: true, providerReference: true, status: true },
    }),
    prisma.generatedContract.findMany({
      where: {
        OR: [
          { document: { storageKey: { contains: "mock-" } } },
          { document: { storageKey: { contains: "demo-" } } },
          { document: { storageKey: { contains: "sample-" } } },
        ],
      },
      select: { id: true, companyId: true, contractNumber: true, documentId: true },
    }),
  ]);

  console.log("EstateOS demo-data audit (read-only)");
  console.log(JSON.stringify({
    counts: {
      demoUsers: demoUsers.length,
      demoCompanies: likelyDemoCompanies.length,
      demoRoles: demoRoles.length,
      demoBuyers: demoUsers.filter((user) => user.clerkUserId.includes("buyer")).length,
      demoInquiries: demoInquiries.length,
      sampleListings: sampleListings.length,
      samplePayments: samplePayments.length,
      sampleContracts: sampleContracts.length,
    },
    demoUsers,
    likelyDemoCompanies,
    demoRoles,
    demoInquiries,
    sampleListings,
    samplePayments,
    sampleContracts,
  }, null, 2));
  console.log("\nSuggested cleanup SQL (review manually; Blueprint is intentionally not included):");
  console.log("SELECT id, \"clerkUserId\", email, \"companyId\" FROM \"User\" WHERE \"clerkUserId\" LIKE 'demo-%' OR \"clerkUserId\" LIKE 'mock:%' OR \"clerkUserId\" LIKE 'sample-%';");
  console.log("SELECT ur.id, ur.\"userId\", ur.\"companyId\", r.name FROM \"UserRole\" ur JOIN \"Role\" r ON r.id = ur.\"roleId\" JOIN \"User\" u ON u.id = ur.\"userId\" WHERE u.\"clerkUserId\" LIKE 'demo-%' OR u.\"clerkUserId\" LIKE 'mock:%' OR u.\"clerkUserId\" LIKE 'sample-%';");
  console.log("-- BEGIN;");
  console.log("-- Delete reported dependent rows first after manual review.");
  console.log("-- DELETE FROM \"UserRole\" WHERE \"userId\" IN (SELECT id FROM \"User\" WHERE \"clerkUserId\" LIKE 'demo-%' OR \"clerkUserId\" LIKE 'mock:%' OR \"clerkUserId\" LIKE 'sample-%');");
  console.log("-- DELETE FROM \"User\" WHERE \"clerkUserId\" LIKE 'demo-%' OR \"clerkUserId\" LIKE 'mock:%' OR \"clerkUserId\" LIKE 'sample-%';");
  console.log("-- ROLLBACK; -- replace with COMMIT only after dependency review");
  console.log("-- Never delete blueprint-urban-residences automatically.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
