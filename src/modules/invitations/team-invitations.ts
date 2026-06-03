import { randomBytes } from "crypto";
import type { AppRole, Prisma, PrismaClient } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import {
  getInvitationAcceptanceFailure,
  normalizeInvitationEmail,
} from "@/lib/auth/invitation-email";
import { assertCompanyAssignmentAllowed } from "@/lib/auth/membership";
import { syncAuthenticatedClerkUser, type ClerkUserSyncInput } from "@/lib/auth/clerk-user-sync";
import { prisma } from "@/lib/db/prisma";
import { env, featureFlags } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { buildTeamInvitationEmail } from "@/lib/notifications/templates/team-invitation";

export const TEAM_INVITATION_TTL_DAYS = 7;
export const TEAM_INVITATION_TTL_MS = TEAM_INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000;
export const SUPERADMIN_INVITABLE_ROLES = ["ADMIN", "STAFF"] as const;
export const TENANT_INVITABLE_ROLES = ["STAFF", "ADMIN", "FINANCE", "LEGAL"] as const;

type InviteActor = {
  userId?: string | null;
  name?: string | null;
  source: "tenant_admin" | "superadmin";
};

type CreateInvitationInput = {
  companyId: string;
  email: string;
  fullName: string;
  role: AppRole;
  branchId?: string | null;
  actor: InviteActor;
  allowedRoles?: readonly AppRole[];
};

type PrismaTx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

function roleLabel(role: AppRole) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

export function invitationExpiresAt(now = new Date()) {
  return new Date(now.getTime() + TEAM_INVITATION_TTL_MS);
}

export function assertInvitableRole(role: AppRole, allowedRoles: readonly AppRole[]) {
  if (role === "SUPER_ADMIN" || !allowedRoles.includes(role)) {
    throw new Error("This role cannot be invited through this flow.");
  }
}

export function requireInvitationEmailDelivery() {
  if (featureFlags.isProduction && !featureFlags.hasResend) {
    throw new Error("Resend is not configured. Configure RESEND_API_KEY before sending invitations.");
  }
}

export function buildInvitationAcceptUrl(token: string) {
  return `${env.APP_BASE_URL.replace(/\/+$/, "")}/accept-invitation/${token}`;
}

async function resolveInviterName(actor: InviteActor) {
  if (actor.name?.trim()) return actor.name.trim();
  if (!actor.userId) return actor.source === "superadmin" ? "EstateOS platform team" : "Your admin";

  const user = await prisma.user.findFirst({
    where: { OR: [{ id: actor.userId }, { clerkUserId: actor.userId }] },
    select: { firstName: true, lastName: true, email: true },
  });
  return `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || user?.email || (actor.source === "superadmin" ? "EstateOS platform team" : "Your admin");
}

async function assertBranchBelongsToCompany(companyId: string, branchId?: string | null) {
  if (!branchId) return null;
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, companyId },
    select: { id: true },
  });
  if (!branch) throw new Error("Selected branch does not belong to this company.");
  return branch.id;
}

export async function createTeamMemberInvitation(input: CreateInvitationInput) {
  requireInvitationEmailDelivery();

  const email = normalizeInvitationEmail(input.email);
  const fullName = input.fullName.trim();
  if (fullName.length < 2) throw new Error("Full name must be at least 2 characters.");
  assertInvitableRole(input.role, input.allowedRoles ?? TENANT_INVITABLE_ROLES);
  const branchId = await assertBranchBelongsToCompany(input.companyId, input.branchId);

  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { id: true, name: true },
  });
  if (!company) throw new Error("Company not found.");

  const token = randomBytes(32).toString("hex");
  const expiresAt = invitationExpiresAt();

  const { invitation, revokedCount } = await prisma.$transaction(async (tx) => {
    const revoked = await tx.teamMemberInvitation.updateMany({
      where: {
        companyId: input.companyId,
        email,
        status: "PENDING",
      },
      data: { status: "REVOKED" },
    });

    const created = await tx.teamMemberInvitation.create({
      data: {
        companyId: input.companyId,
        branchId,
        email,
        fullName,
        role: input.role,
        token,
        expiresAt,
        invitedByUserId: input.actor.userId ?? undefined,
      },
    });

    return { invitation: created, revokedCount: revoked.count };
  });

  if (revokedCount > 0) {
    await writeAuditLog({
      companyId: input.companyId,
      actorUserId: input.actor.userId ?? undefined,
      action: "UPDATE",
      entityType: "TeamMemberInvitation",
      entityId: invitation.id,
      summary: "Existing pending team invitation was replaced.",
      payload: { email, role: input.role, source: input.actor.source, revokedCount } as Prisma.InputJsonValue,
    });
  }

  await writeAuditLog({
    companyId: input.companyId,
    actorUserId: input.actor.userId ?? undefined,
    action: "CREATE",
    entityType: "TeamMemberInvitation",
    entityId: invitation.id,
    summary: `${input.actor.source === "superadmin" ? "Superadmin" : "Tenant admin"} created a team invitation.`,
    payload: {
      email,
      role: input.role,
      branchId,
      source: input.actor.source,
      expiresAt: expiresAt.toISOString(),
    } as Prisma.InputJsonValue,
  });

  const inviterName = await resolveInviterName(input.actor);
  const acceptUrl = buildInvitationAcceptUrl(token);
  const { subject, html } = buildTeamInvitationEmail({
    inviteeName: fullName,
    companyName: company.name,
    inviterName,
    role: input.role,
    acceptUrl,
    expiresAt,
  });

  await sendTransactionalEmail({ to: email, subject, html });
  await writeAuditLog({
    companyId: input.companyId,
    actorUserId: input.actor.userId ?? undefined,
    action: "UPDATE",
    entityType: "TeamMemberInvitation",
    entityId: invitation.id,
    summary: "Team invitation email sent.",
    payload: { email, role: input.role, source: input.actor.source } as Prisma.InputJsonValue,
  });

  return invitation;
}

export async function acceptTeamMemberInvitation(input: {
  token: string;
  clerkUser: ClerkUserSyncInput;
}) {
  const invitation = await prisma.teamMemberInvitation.findUnique({
    where: { token: input.token },
    include: { company: { select: { id: true, name: true, slug: true } } },
  });
  if (!invitation) throw new Error("Invitation not found.");

  const acceptanceFailure = getInvitationAcceptanceFailure(invitation);
  if (acceptanceFailure?.status === 410) {
    await prisma.teamMemberInvitation.update({
      where: { token: input.token },
      data: { status: "EXPIRED" },
    });
    await writeAuditLog({
      companyId: invitation.companyId,
      action: "UPDATE",
      entityType: "TeamMemberInvitation",
      entityId: invitation.id,
      summary: "Team invitation expired.",
      payload: { email: invitation.email, role: invitation.role } as Prisma.InputJsonValue,
    });
  } else if (acceptanceFailure) {
    await writeAuditLog({
      companyId: invitation.companyId,
      action: "UPDATE",
      entityType: "TeamMemberInvitation",
      entityId: invitation.id,
      summary: "Team invitation acceptance was rejected.",
      payload: {
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        reason: acceptanceFailure.message,
      } as Prisma.InputJsonValue,
    });
  }
  if (acceptanceFailure) {
    const error = new Error(acceptanceFailure.message);
    Object.assign(error, { status: acceptanceFailure.status });
    throw error;
  }

  const synced = await syncAuthenticatedClerkUser(input.clerkUser);
  const user = await prisma.user.findUnique({ where: { id: synced.userId } });
  if (!user) throw new Error("Your account could not be found.");

  try {
    assertCompanyAssignmentAllowed(user.companyId, invitation.companyId);
  } catch {
    const error = new Error("This account already belongs to another company.");
    Object.assign(error, { status: 409 });
    throw error;
  }

  const accepted = await prisma.$transaction(async (tx: PrismaTx) => {
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
        label: roleLabel(invitation.role as AppRole),
      },
      update: {},
    });

    await tx.user.update({
      where: { id: user.id },
      data: {
        companyId: invitation.companyId,
        branchId: invitation.branchId ?? user.branchId,
      },
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
    const error = new Error("This invitation has already been accepted or is no longer valid.");
    Object.assign(error, { status: 409 });
    throw error;
  }

  await writeAuditLog({
    companyId: invitation.companyId,
    actorUserId: user.id,
    action: "UPDATE",
    entityType: "TeamMemberInvitation",
    entityId: invitation.id,
    summary: "Team invitation accepted.",
    payload: {
      email: invitation.email,
      role: invitation.role,
      branchId: invitation.branchId,
      userId: user.id,
      clerkUserId: input.clerkUser.clerkUserId,
    } as Prisma.InputJsonValue,
  });

  return {
    companySlug: invitation.company.slug,
    redirectTo: "/admin",
  };
}

export function invitationErrorStatus(error: unknown) {
  if (error && typeof error === "object" && "status" in error) {
    const status = Number((error as { status?: unknown }).status);
    if (Number.isInteger(status) && status >= 400 && status < 600) return status;
  }
  return 400;
}
