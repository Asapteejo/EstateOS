import { randomBytes } from "crypto";

import { requireAdminSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { env, featureFlags } from "@/lib/env";
import { fail, ok } from "@/lib/http";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { buildTeamInvitationEmail } from "@/lib/notifications/templates/team-invitation";

const INVITE_TTL_MS = 48 * 60 * 60 * 1000;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication required.", 401);
  }

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

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const updated = await prisma.teamMemberInvitation.update({
    where: { id },
    data: { token, expiresAt, status: "PENDING" },
  });

  const [company, inviter] = await Promise.all([
    prisma.company.findUnique({ where: { id: tenant.companyId }, select: { name: true } }),
    tenant.userId
      ? prisma.user.findUnique({
          where: { clerkUserId: tenant.userId },
          select: { firstName: true, lastName: true },
        })
      : null,
  ]);

  const inviterName =
    `${inviter?.firstName ?? ""} ${inviter?.lastName ?? ""}`.trim() || "Your admin";

  const acceptUrl = `${env.APP_BASE_URL}/accept-invitation/${token}`;
  const { subject, html } = buildTeamInvitationEmail({
    inviteeName: existing.fullName,
    companyName: company?.name ?? "EstateOS",
    inviterName,
    role: existing.role,
    acceptUrl,
    expiresAt,
  });

  await sendTransactionalEmail({ to: existing.email, subject, html });

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
