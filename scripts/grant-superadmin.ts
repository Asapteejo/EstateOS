import { loadEnvConfig } from "@next/env";

import {
  assertAllowlistedSuperadminEmail,
  maskEmail,
  parseGrantSuperadminEmail,
} from "@/lib/auth/grant-superadmin";
import { prisma } from "@/lib/db/prisma";

loadEnvConfig(process.cwd());

async function main() {
  const email = parseGrantSuperadminEmail(process.argv.slice(2));
  assertAllowlistedSuperadminEmail(email, process.env.SUPERADMIN_EMAILS);

  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      email: true,
    },
  });

  if (!user) {
    throw new Error(
      "No EstateOS user exists for that allowlisted email. Sign in once normally, then rerun this command.",
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const role =
      (await tx.role.findFirst({
        where: {
          name: "SUPER_ADMIN",
          companyId: null,
        },
        select: {
          id: true,
        },
      })) ??
      (await tx.role.create({
        data: {
          name: "SUPER_ADMIN",
          label: "Super Admin",
          companyId: null,
        },
        select: {
          id: true,
        },
      }));

    const existingAssignment = await tx.userRole.findFirst({
      where: {
        userId: user.id,
        roleId: role.id,
        companyId: null,
      },
      select: {
        id: true,
      },
    });

    if (existingAssignment) {
      return {
        assignmentCreated: false,
      };
    }

    await tx.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
        companyId: null,
      },
    });

    return {
      assignmentCreated: true,
    };
  });

  console.log(JSON.stringify({
    success: true,
    role: "SUPER_ADMIN",
    userId: user.id,
    email: maskEmail(user.email),
    assignmentCreated: result.assignmentCreated,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Unable to grant SUPER_ADMIN.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
