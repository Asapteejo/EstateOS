import { auth, currentUser } from "@clerk/nextjs/server";

import {
  getInvitationAcceptanceFailure,
  hasMatchingVerifiedInvitationEmail,
} from "@/lib/auth/invitation-email";
import { writeAuditLog } from "@/lib/audit/service";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { fail, ok } from "@/lib/http";
import {
  acceptTeamMemberInvitation,
  invitationErrorStatus,
} from "@/modules/invitations/team-invitations";

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
  if (acceptanceFailure) {
    await writeAuditLog({
      companyId: invitation.companyId,
      action: "UPDATE",
      entityType: "TeamMemberInvitation",
      entityId: invitation.id,
      summary: "Team invitation acceptance was rejected.",
      payload: {
        invitationEmail: invitation.email,
        role: invitation.role,
        status: invitation.status,
        reason: acceptanceFailure.message,
      },
    });
    return fail(acceptanceFailure.message, acceptanceFailure.status);
  }

  const clerkIdentity = await currentUser();
  if (
    clerkIdentity?.id !== clerkUserId ||
    !hasMatchingVerifiedInvitationEmail(invitation.email, clerkIdentity.emailAddresses)
  ) {
    await writeAuditLog({
      companyId: invitation.companyId,
      action: "UPDATE",
      entityType: "TeamMemberInvitation",
      entityId: invitation.id,
      summary: "Team invitation acceptance email mismatch.",
      payload: {
        invitationEmail: invitation.email,
        clerkUserId,
      },
    });
    return fail("Sign in with the verified email address that received this invitation.", 403);
  }

  const primaryEmail =
    clerkIdentity.emailAddresses.find((address) => address.id === clerkIdentity.primaryEmailAddressId) ??
    clerkIdentity.emailAddresses.find((address) => address.emailAddress.toLowerCase() === invitation.email.toLowerCase()) ??
    clerkIdentity.emailAddresses[0];

  try {
    const result = await acceptTeamMemberInvitation({
      token,
      clerkUser: {
        clerkUserId,
        email: primaryEmail.emailAddress,
        firstName: clerkIdentity.firstName,
        lastName: clerkIdentity.lastName,
        phone: clerkIdentity.phoneNumbers[0]?.phoneNumber,
      },
    });
    return ok(result);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to accept invitation.", invitationErrorStatus(error));
  }
}
