import { NextResponse } from "next/server";

import { requireBuyerPortalSession } from "@/lib/auth/guards";
import { getAppSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { fail, ok } from "@/lib/http";
import {
  buildDevBuyerProfileData,
  buildDevBuyerUserUpdate,
  selectDevBuyerUser,
} from "@/modules/dev/buyer-profile";
export const runtime = "nodejs";

export async function POST() {
  if (featureFlags.isProduction) {
    return fail("Dev buyer profile helper is not available in production.", 404);
  }

  let tenant: Awaited<ReturnType<typeof requireBuyerPortalSession>>;

  try {
    tenant = await requireBuyerPortalSession({ redirectOnMissingAuth: false });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Buyer access is required.", 403);
  }

  if (!featureFlags.hasDatabase || !tenant.companyId || !tenant.userId) {
    return ok({ created: false, reason: "Database not configured." });
  }

  const session = await getAppSession("portal");

  const firstName = session?.firstName?.trim() || "Ada";
  const lastName = session?.lastName?.trim() || "Okafor";
  const email =
    session?.email?.trim() ||
    `buyer+${tenant.companySlug ?? tenant.companyId}@estateos.dev`;

  const user = await prisma.$transaction(async (tx) => {
    const role = await tx.role.upsert({
      where: {
        companyId_name: {
          companyId: tenant.companyId!,
          name: "BUYER",
        },
      },
      update: {
        label: "Buyer",
      },
      create: {
        companyId: tenant.companyId!,
        name: "BUYER",
        label: "Buyer",
      },
      select: {
        id: true,
      },
    });

    const [userById, userByEmail] = await Promise.all([
      tx.user.findUnique({
        where: { id: tenant.userId! },
        select: { id: true, email: true },
      }),
      tx.user.findUnique({
        where: { email },
        select: { id: true, email: true },
      }),
    ]);
    const selectedUser = selectDevBuyerUser({ byId: userById, byEmail: userByEmail });
    const userData = buildDevBuyerUserUpdate({
      companyId: tenant.companyId!,
      branchId: tenant.branchId,
      firstName,
      lastName,
      email,
    });
    const profileData = buildDevBuyerProfileData();

    const createdUser = selectedUser
      ? await tx.user.update({
          where: { id: selectedUser.id },
          data: userData,
          select: {
            id: true,
            email: true,
          },
        })
      : await tx.user.create({
          data: {
            id: tenant.userId!,
            clerkUserId:
              session?.mode === "clerk" ? session.userId : `dev-${tenant.userId}`,
            ...userData,
          },
          select: {
            id: true,
            email: true,
          },
        });

    await tx.profile.upsert({
      where: {
        userId: createdUser.id,
      },
      update: profileData,
      create: {
        userId: createdUser.id,
        ...profileData,
      },
    });

    await tx.user.update({
      where: {
        id: createdUser.id,
      },
      data: {
        companyId: tenant.companyId,
        branchId: tenant.branchId,
      },
      select: {
        id: true,
        email: true,
      },
    });

    await tx.userRole.upsert({
      where: {
        userId_roleId_companyId: {
          userId: createdUser.id,
          roleId: role.id,
          companyId: tenant.companyId!,
        },
      },
      update: {},
      create: {
        userId: createdUser.id,
        roleId: role.id,
        companyId: tenant.companyId!,
      },
    });

    return createdUser;
  });

  return NextResponse.json({
    ok: true,
    userId: user.id,
    email: user.email,
  });
}
