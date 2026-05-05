import type { AppRole } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { env, featureFlags } from "@/lib/env";
import type { DemoSessionRole } from "@/lib/auth/session";

const devUsers: Record<
  DemoSessionRole,
  {
    clerkUserId: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: AppRole[];
  }
> = {
  buyer: {
    clerkUserId: "demo-buyer",
    email: "buyer@acmerealty.dev",
    firstName: "Ada",
    lastName: "Okafor",
    roles: ["BUYER"],
  },
  admin: {
    clerkUserId: "demo-admin",
    email: "admin@acmerealty.dev",
    firstName: "Tobi",
    lastName: "Adewale",
    roles: ["ADMIN"],
  },
  superadmin: {
    clerkUserId: "demo-superadmin",
    email: "owner@estateos.dev",
    firstName: "Maya",
    lastName: "Cole",
    roles: ["SUPER_ADMIN"],
  },
};

async function resolveDevCompany() {
  if (!featureFlags.hasDatabase) {
    return null;
  }

  return (
    (env.DEFAULT_COMPANY_SLUG
      ? await prisma.company.findFirst({
          where: {
            OR: [
              { slug: env.DEFAULT_COMPANY_SLUG },
              { subdomain: env.DEFAULT_COMPANY_SLUG },
            ],
          },
          select: {
            id: true,
            slug: true,
            branches: {
              select: { id: true },
              orderBy: { createdAt: "asc" },
              take: 1,
            },
          },
        })
      : null) ??
    (await prisma.company.findFirst({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        slug: true,
        branches: {
          select: { id: true },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    }))
  );
}

export async function ensureDevSessionUser(role: DemoSessionRole) {
  if (!featureFlags.hasDatabase || featureFlags.isProduction) {
    return null;
  }

  const devUser = devUsers[role];
  const company = await resolveDevCompany();
  const companyId = role === "superadmin" ? null : company?.id ?? null;
  const branchId = role === "superadmin" ? null : company?.branches[0]?.id ?? null;

  const existing =
    (await prisma.user.findUnique({
      where: { clerkUserId: devUser.clerkUserId },
      select: { id: true },
    })) ??
    (await prisma.user.findUnique({
      where: { email: devUser.email },
      select: { id: true },
    }));

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          clerkUserId: devUser.clerkUserId,
          email: devUser.email,
          firstName: devUser.firstName,
          lastName: devUser.lastName,
          companyId,
          branchId,
          isActive: true,
        },
        select: { id: true },
      })
    : await prisma.user.create({
        data: {
          clerkUserId: devUser.clerkUserId,
          email: devUser.email,
          firstName: devUser.firstName,
          lastName: devUser.lastName,
          companyId,
          branchId,
          isActive: true,
        },
        select: { id: true },
      });

  for (const appRole of devUser.roles) {
    const roleCompanyId = appRole === "SUPER_ADMIN" ? null : companyId;
    const roleLabel = appRole
      .split("_")
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join(" ");
    const roleRecord =
      (await prisma.role.findFirst({
        where: {
          companyId: roleCompanyId,
          name: appRole,
        },
        select: { id: true },
      })) ??
      (await prisma.role.create({
        data: {
          companyId: roleCompanyId,
          name: appRole,
          label: roleLabel,
        },
        select: { id: true },
      }));

    const userRole = await prisma.userRole.findFirst({
      where: {
        userId: user.id,
        roleId: roleRecord.id,
        companyId: roleCompanyId,
      },
    });

    if (!userRole) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: roleRecord.id,
          companyId: roleCompanyId,
        },
      });
    }
  }

  return {
    userId: user.id,
    companyId,
    companySlug: company?.slug ?? null,
    branchId,
  };
}
