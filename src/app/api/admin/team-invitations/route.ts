import { z } from "zod";

import { requireAdminSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { fail, ok } from "@/lib/http";
import {
  createTeamMemberInvitation,
  invitationErrorStatus,
  TENANT_INVITABLE_ROLES,
} from "@/modules/invitations/team-invitations";

export const runtime = "nodejs";

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

  let invitation: Awaited<ReturnType<typeof createTeamMemberInvitation>>;
  try {
    invitation = await createTeamMemberInvitation({
      companyId: tenant.companyId,
      email: body.data.email,
      fullName: body.data.fullName,
      role: body.data.role,
      actor: { userId: tenant.userId, source: "tenant_admin" },
      allowedRoles: TENANT_INVITABLE_ROLES,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to send invitation.", invitationErrorStatus(error));
  }

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
