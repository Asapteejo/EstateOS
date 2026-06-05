import { randomBytes } from "crypto";
import type { AppRole } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import { requireAdminSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { fail, ok } from "@/lib/http";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { buildTeamInvitationEmail } from "@/lib/notifications/templates/team-invitation";
import {
  buildInvitationAcceptUrl,
  invitationExpiresAt,
  requireInvitationEmailDelivery,
} from "@/modules/invitations/team-invitations";
import {
  adminMutationRateLimit,
  enforceRateLimit,
  getClientIp,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication required.", 401);
  }

  const rateLimited = await enforceRateLimit(
    adminMutationRateLimit,
    [`ip:${getClientIp(request)}`, `user:${tenant.userId ?? "admin"}`],
    "Too many requests. Please slow down and try again.",
  );
  if (rateLimited) return rateLimited;

  if (!featureFlags.hasDatabase || !tenant.companyId) {
    return fail("Service unavailable.", 503);
  }

  const { id } = await params;

  const existing = await prisma.teamMemberInvitation.findFirst({
    where: { id, companyId: tenant.companyId },
  });

  if (!existing) {
    return fail("Invitation not found.", 404);
  }

  if (existing.status === "ACCEPTED") {
    return fail("This invitation has already been accepted.", 409);
  }

  try {
    requireInvitationEmailDelivery();
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to resend invitation.", 503);
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = invitationExpiresAt();

  const updated = await prisma.teamMemberInvitation.update({
    where: { id, companyId: tenant.companyId },
    data: { token, expiresAt, status: "PENDING" },
  });

  const [company, inviter] = await Promise.all([
    prisma.company.findUnique({ where: { id: tenant.companyId }, select: { name: true } }),
    tenant.clerkUserId
      ? prisma.user.findUnique({
          where: { clerkUserId: tenant.clerkUserId },
          select: { firstName: true, lastName: true },
        })
      : null,
  ]);

  const inviterName =
    `${inviter?.firstName ?? ""} ${inviter?.lastName ?? ""}`.trim() || "Your admin";

  const acceptUrl = buildInvitationAcceptUrl(token);
  const { subject, html } = buildTeamInvitationEmail({
    inviteeName: existing.fullName,
    companyName: company?.name ?? "EstateOS",
    inviterName,
    role: existing.role as AppRole,
    acceptUrl,
    expiresAt,
  });

  await sendTransactionalEmail({ to: existing.email, subject, html });
  await writeAuditLog({
    companyId: tenant.companyId,
    actorUserId: tenant.userId ?? undefined,
    action: "UPDATE",
    entityType: "TeamMemberInvitation",
    entityId: updated.id,
    summary: "Team invitation resent.",
    payload: {
      email: updated.email,
      role: updated.role,
      expiresAt: updated.expiresAt.toISOString(),
    },
  });

  return ok({
    invitation: {
      id: updated.id,
      email: updated.email,
      fullName: updated.fullName,
      role: updated.role,
      status: updated.status,
      expiresAt: updated.expiresAt,
    },
  });
}
