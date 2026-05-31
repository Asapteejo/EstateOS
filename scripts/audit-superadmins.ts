import { loadEnvConfig } from "@next/env";

import { prisma } from "@/lib/db/prisma";
import { parseSuperadminEmails } from "@/lib/auth/superadmin";

loadEnvConfig(process.cwd());

async function main() {
  const allowlist = parseSuperadminEmails(process.env.SUPERADMIN_EMAILS);
  const assignments = await prisma.userRole.findMany({
    where: {
      role: {
        name: "SUPER_ADMIN",
      },
    },
    select: {
      companyId: true,
      createdAt: true,
      role: {
        select: {
          id: true,
          companyId: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          clerkUserId: true,
          isActive: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const rows = assignments.map((assignment) => ({
    userId: assignment.user.id,
    email: assignment.user.email,
    clerkUserIdConfigured: Boolean(assignment.user.clerkUserId),
    isActive: assignment.user.isActive,
    assignmentCompanyId: assignment.companyId,
    roleCompanyId: assignment.role.companyId,
    allowlisted: allowlist.has(assignment.user.email.trim().toLowerCase()),
  }));
  const unauthorizedCount = rows.filter((row) => !row.allowlisted).length;

  console.log(JSON.stringify({
    allowlistConfigured: allowlist.size > 0,
    allowlistCount: allowlist.size,
    superadminAssignmentCount: rows.length,
    unauthorizedCount,
    assignments: rows,
  }, null, 2));

  if (unauthorizedCount > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Unable to audit superadmin assignments.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
