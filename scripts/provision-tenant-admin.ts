import { loadEnvConfig } from "@next/env";

import { maskEmail } from "@/lib/auth/grant-superadmin";
import { prisma } from "@/lib/db/prisma";
import {
  assertProvisioningCompanyMatch,
  assertProvisioningCompanyExists,
  buildManualTenantAdminUser,
  parseProvisionTenantAdminArgs,
  splitProvisionedName,
  TENANT_ADMIN_ROLE,
} from "@/lib/ops/tenant-provisioning";

loadEnvConfig(process.cwd());

async function main() {
  const input = parseProvisionTenantAdminArgs(process.argv.slice(2));
  const company = assertProvisioningCompanyExists(await prisma.company.findUnique({
    where: { slug: input.companySlug },
    select: { id: true, name: true, slug: true, status: true },
  }), input.companySlug);

  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, email: true, clerkUserId: true, companyId: true },
  });
  assertProvisioningCompanyMatch(existing?.companyId, company.id);

  const result = await prisma.$transaction(async (tx) => {
    const names = splitProvisionedName(input.name);
    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: {
            companyId: company.id,
            firstName: names.firstName,
            lastName: names.lastName,
            isActive: true,
          },
          select: { id: true, email: true, clerkUserId: true },
        })
      : await tx.user.create({
          data: {
            ...buildManualTenantAdminUser(input),
            companyId: company.id,
          },
          select: { id: true, email: true, clerkUserId: true },
        });
    const role = await tx.role.upsert({
      where: {
        companyId_name: {
          companyId: company.id,
          name: TENANT_ADMIN_ROLE,
        },
      },
      create: {
        companyId: company.id,
        name: TENANT_ADMIN_ROLE,
        label: "Admin",
      },
      update: {
        label: "Admin",
      },
      select: { id: true, name: true },
    });
    const assignment = await tx.userRole.upsert({
      where: {
        userId_roleId_companyId: {
          userId: user.id,
          roleId: role.id,
          companyId: company.id,
        },
      },
      create: {
        userId: user.id,
        roleId: role.id,
        companyId: company.id,
      },
      update: {},
      select: { id: true },
    });

    return { user, role, assignment, created: !existing };
  });

  console.log("EstateOS tenant admin provisioned");
  console.log(JSON.stringify({
    success: true,
    company: { id: company.id, slug: company.slug, status: company.status },
    userId: result.user.id,
    email: maskEmail(result.user.email),
    role: result.role.name,
    assignmentId: result.assignment.id,
    pendingClerkSetup: result.user.clerkUserId.startsWith("manual:"),
    created: result.created,
  }, null, 2));
  console.log("\nLogin setup:");
  console.log("1. In Clerk, invite this email or create the user and send a password setup/reset link.");
  console.log("2. Do not store or print a plaintext temporary password in EstateOS.");
  console.log("3. On first Clerk sign-in, EstateOS links the Clerk identity to this tenant user by email.");
  console.log("4. Open /admin after authentication.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
