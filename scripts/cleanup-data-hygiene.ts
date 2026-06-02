import { loadEnvConfig } from "@next/env";

import { prisma } from "@/lib/db/prisma";
import {
  assertCleanupAllowlistConfigured,
  buildCleanupPlan,
  parseCleanupMode,
} from "@/lib/ops/data-hygiene";

loadEnvConfig(process.cwd());

async function main() {
  const mode = parseCleanupMode(process.argv.slice(2));
  assertCleanupAllowlistConfigured(process.env.SUPERADMIN_EMAILS);

  const [users, assignments] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        clerkUserId: true,
        email: true,
        companyId: true,
        isActive: true,
        company: { select: { slug: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.userRole.findMany({
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
    }),
  ]);
  const normalizedUsers = users.map((user) => ({
    ...user,
    companySlug: user.company?.slug ?? null,
  }));
  const normalizedAssignments = assignments.map((assignment) => ({
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
  const plan = buildCleanupPlan(
    normalizedAssignments,
    normalizedUsers,
    process.env.SUPERADMIN_EMAILS,
  );

  console.log("EstateOS conservative data-hygiene cleanup");
  console.log(JSON.stringify({
    mode: mode.apply ? "apply" : "dry-run",
    restrictions: [
      "Blueprint tenant records are never mutated.",
      "Companies, payments, transactions, contracts, documents, and KYC rows are never deleted.",
      "Only reported UserRole rows are removed and clearly demo users are deactivated.",
    ],
    plan,
  }, null, 2));

  if (!mode.apply) {
    console.log("\nDry run only. Re-run with --apply --confirm \"CLEAN_DEMO_DATA\" after manual review.");
    return;
  }

  const roleIds = plan.roleAssignments.map((assignment) => assignment.id);
  const userIds = plan.deactivateUsers.map((user) => user.id);
  const result = await prisma.$transaction(async (tx) => {
    const removedRoles = roleIds.length > 0
      ? await tx.userRole.deleteMany({ where: { id: { in: roleIds } } })
      : { count: 0 };
    const deactivatedUsers = userIds.length > 0
      ? await tx.user.updateMany({
          where: { id: { in: userIds } },
          data: { isActive: false },
        })
      : { count: 0 };

    return {
      removedRoleAssignments: removedRoles.count,
      deactivatedDemoUsers: deactivatedUsers.count,
    };
  });

  console.log("\nCleanup result");
  console.log(JSON.stringify({
    applied: true,
    ...result,
    completedAt: new Date().toISOString(),
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
