import { auth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { fail, ok } from "@/lib/http";

// ─── GET — validate token and return invitation info ─────────────────────────

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

  if (!invitation) {
    return fail("Invitation not found.", 404);
  }

  if (invitation.status === "ACCEPTED") {
    return fail("This invitation has already been accepted.", 409);
  }

  if (invitation.status === "REVOKED" || invitation.status === "EXPIRED") {
    return fail("This invitation is no longer valid.", 410);
  }

  if (invitation.expiresAt < new Date()) {
    // Lazily mark as expired
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

// ─── POST — accept invitation (requires Clerk auth) ──────────────────────────

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!featureFlags.hasDatabase) {
    return fail("Service unavailable.", 503);
  }

  // Require Clerk session
  let clerkUserId: string | null = null;
  if (featureFlags.hasClerk) {
    const session = await auth();
    clerkUserId = session.userId ?? null;
  }

  if (!clerkUserId) {
    return fail("Authentication required.", 401);
  }

  const invitation = await prisma.teamMemberInvitation.findUnique({
    where: { token },
    include: { company: { select: { id: true, name: true, slug: true } } },
  });

  if (!invitation) {
    return fail("Invitation not found.", 404);
  }

  if (invitation.status !== "PENDING") {
    return fail(
      invitation.status === "ACCEPTED"
        ? "This invitation has already been accepted."
        : "This invitation is no longer valid.",
      409,
    );
  }

  if (invitation.expiresAt < new Date()) {
    await prisma.teamMemberInvitation.update({
      where: { token },
      data: { status: "EXPIRED" },
    });
    return fail("This invitation has expired.", 410);
  }

  // Find or create the User record for this Clerk user
  let user = await prisma.user.findUnique({ where: { clerkUserId } });

  if (!user) {
    // User may not be synced yet from webhook — try by email
    user = await prisma.user.findUnique({ where: { email: invitation.email } });
  }

  if (!user) {
    return fail(
      "Your account could not be found. Please sign up with the email address this invitation was sent to.",
      422,
    );
  }

  // Find or create the Role record for this company + role name
  let role = await prisma.role.findFirst({
    where: { companyId: invitation.companyId, name: invitation.role },
  });

  if (!role) {
    role = await prisma.role.create({
      data: {
        companyId: invitation.companyId,
        name: invitation.role,
        label: invitation.role.charAt(0) + invitation.role.slice(1).toLowerCase(),
      },
    });
  }

  await prisma.$transaction([
    // Link user to company
    prisma.user.update({
      where: { id: user.id },
      data: { companyId: invitation.companyId },
    }),
    // Assign role (upsert to avoid duplicate)
    prisma.userRole.upsert({
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
    }),
    // Mark invitation accepted
    prisma.teamMemberInvitation.update({
      where: { token },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    }),
  ]);

  return ok({
    companySlug: invitation.company.slug,
    redirectTo: "/admin",
  });
}
