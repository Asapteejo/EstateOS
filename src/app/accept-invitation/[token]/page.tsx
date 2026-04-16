import { notFound } from "next/navigation";
import type { AppRole } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { AcceptInvitationClient } from "./accept-invitation-client";

const ROLE_LABELS: Record<AppRole, string> = {
  BUYER: "Buyer",
  STAFF: "Staff",
  ADMIN: "Admin",
  LEGAL: "Legal",
  FINANCE: "Finance",
  SUPER_ADMIN: "Super Admin",
};

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!featureFlags.hasDatabase) {
    notFound();
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
      company: { select: { name: true, slug: true, logoUrl: true } },
    },
  });

  if (!invitation) {
    notFound();
  }

  const isExpired =
    invitation.status === "EXPIRED" ||
    invitation.status === "REVOKED" ||
    (invitation.status === "PENDING" && invitation.expiresAt < new Date());

  return (
    <AcceptInvitationClient
      token={token}
      inviteeName={invitation.fullName}
      inviteeEmail={invitation.email}
      companyName={invitation.company.name}
      companyLogoUrl={invitation.company.logoUrl}
      roleLabel={ROLE_LABELS[invitation.role] ?? invitation.role}
      isAccepted={invitation.status === "ACCEPTED"}
      isExpired={isExpired}
      hasClerk={featureFlags.hasClerk}
    />
  );
}
