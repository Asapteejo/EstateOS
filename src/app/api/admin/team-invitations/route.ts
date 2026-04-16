import { randomBytes } from "crypto";
import type { AppRole } from "@prisma/client";
import { z } from "zod";

import { requireAdminSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { env, featureFlags } from "@/lib/env";
import { fail, ok } from "@/lib/http";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { buildTeamInvitationEmail } from "@/lib/notifications/templates/team-invitation";

const INVITE_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

const inviteSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters."),
  email: z.string().email("A valid email address is required."),
  role: z.enum(["STAFF", "ADMIN", "FINANCE", "LEGAL"] as const),
});

// ─── GET — list pending invitations ──────────────────────────────────────────

export async function GET() {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication required.", 401);
  }

  if (!featureFlags.hasDatabase || !tenant.companyId) {
    return ok({ invitations: [] });
  }

  const invitations = await prisma.teamMemberInvitation.findMany({
    where: {
      companyId: tenant.companyId,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      status: true,
      createdAt: true,
      expiresAt: true,
    },
  });

  return ok({ invitations });
}

// ─── POST — create invitation ─────────────────────────────────────────────────

export async function POST(request: Request) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication required.", 401);
  }

  if (!featureFlags.hasDatabase || !tenant.companyId) {
    return fail("Service unavailable.", 503);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail("Invalid request body.", 400);
  }

  const body = inviteSchema.safeParse(json);
  if (!body.success) {
    return fail(body.error.issues[0]?.message ?? "Invalid input.", 400);
  }

  // Revoke any existing pending invite for this email at this company
  await prisma.teamMemberInvitation.updateMany({
    where: {
      companyId: tenant.companyId,
      email: body.data.email.toLowerCase(),
      status: "PENDING",
    },
    data: { status: "REVOKED" },
  });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const invitation = await prisma.teamMemberInvitation.create({
    data: {
      companyId: tenant.companyId,
      email: body.data.email.toLowerCase(),
      fullName: body.data.fullName,
      role: body.data.role as AppRole,
      token,
      expiresAt,
      invitedByUserId: tenant.userId ?? undefined,
    },
  });

  // Send invitation email
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
    inviteeName: body.data.fullName,
    companyName: company?.name ?? "EstateOS",
    inviterName,
    role: body.data.role as AppRole,
    acceptUrl,
    expiresAt,
  });

  await sendTransactionalEmail({ to: body.data.email, subject, html });

  return ok(
    {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        fullName: invitation.fullName,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      },
    },
    { status: 201 },
  );
}
