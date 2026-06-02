import { auth, currentUser } from "@clerk/nextjs/server";
import type { AppRole } from "@prisma/client";

import {
  getInvitationAcceptanceFailure,
  hasMatchingVerifiedInvitationEmail,
} from "@/lib/auth/invitation-email";
import { assertCompanyAssignmentAllowed } from "@/lib/auth/membership";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { fail, ok } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!featureFlags.hasDatabase) {
    return fail("Service unavailable.", 503);
  }

  const invitation = await prisma.teamMemberInvitation.findUnique({
    where: { token },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      status: true,
      expiresAt: true,
      company: { select: { name: true, slug: true } },
    },
  });

  if (!invitation) return fail("Invitation not found.", 404);
  if (invitation.role === "SUPER_ADMIN") return fail("This invitation is not valid.", 403);
  if (invitation.status === "ACCEPTED") {
    return fail("This invitation has already been accepted.", 409);
  }
  if (invitation.status === "REVOKED" || invitation.status === "EXPIRED") {
    return fail("This invitation is no longer valid.", 410);
  }
  if (invitation.expiresAt < new Date()) {
    await prisma.teamMemberInvitation.update({
      where: { token },
      data: { status: "EXPIRED" },
    });
    return fail("This invitation has expired.", 410);
  }

  return ok({
    invitation: {
      email: invitation.email,
      fullName: invitation.fullName,
      role: invitation.role,
      companyName: invitation.company.name,
      companySlug: invitation.company.slug,
    },
  });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!featureFlags.hasDatabase) return fail("Service unavailable.", 503);

  const session = featureFlags.hasClerk ? await auth() : null;
  const clerkUserId = session?.userId ?? null;
  if (!clerkUserId) return fail("Authentication required.", 401);

  const invitation = await prisma.teamMemberInvitation.findUnique({
    where: { token },
    include: { company: { select: { id: true, name: true, slug: true } } },
  });
  if (!invitation) return fail("Invitation not found.", 404);
  const acceptanceFailure = getInvitationAcceptanceFailure(invitation);
  if (acceptanceFailure?.status === 410) {
    await prisma.teamMemberInvitation.update({
      where: { token },
      data: { status: "EXPIRED" },
    });
  }
  if (acceptanceFailure) return fail(acceptanceFailure.message, acceptanceFailure.status);

  const clerkIdentity = await currentUser();
  if (
    clerkIdentity?.id !== clerkUserId ||
    !hasMatchingVerifiedInvitationEmail(invitation.email, clerkIdentity.emailAddresses)
  ) {
    return fail("Sign in with the verified email address that received this invitation.", 403);
  }

  const user = await prisma.user.findUnique({ where: { clerkUserId } });
  if (!user) {
    return fail(
      "Your account could not be found. Please sign in once with the invited email address, then retry.",
      422,
    );
  }
  try {
    assertCompanyAssignmentAllowed(user.companyId, invitation.companyId);
  } catch {
    return fail("This account already belongs to another company.", 409);
  }

  const accepted = await prisma.$transaction(async (tx) => {
    const claimed = await tx.teamMemberInvitation.updateMany({
      where: {
        id: invitation.id,
        status: "PENDING",
        expiresAt: { gte: new Date() },
      },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
    if (claimed.count !== 1) return false;

    const role = await tx.role.upsert({
      where: {
        companyId_name: {
          companyId: invitation.companyId,
          name: invitation.role as AppRole,
        },
      },
      create: {
        companyId: invitation.companyId,
        name: invitation.role as AppRole,
        label: invitation.role.charAt(0) + invitation.role.slice(1).toLowerCase(),
      },
      update: {},
    });
    await tx.user.update({
      where: { id: user.id },
      data: { companyId: invitation.companyId },
    });
    await tx.userRole.upsert({
      where: {
        userId_roleId_companyId: {
          userId: user.id,
          roleId: role.id,
          companyId: invitation.companyId,
        },
      },
      create: {
        userId: user.id,
        roleId: role.id,
        companyId: invitation.companyId,
      },
      update: {},
    });
    return true;
  });

  if (!accepted) {
    return fail("This invitation has already been accepted or is no longer valid.", 409);
  }

  return ok({
    companySlug: invitation.company.slug,
    redirectTo: "/admin",
  });
}
