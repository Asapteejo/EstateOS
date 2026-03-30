import { Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import { hasRequiredRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import type { TenantContext } from "@/lib/tenancy/context";
import { findFirstForTenant, rejectUnsafeCompanyIdInput } from "@/lib/tenancy/db";
import type { TeamMemberMutationInput } from "@/lib/validations/team";
import { buildUniqueTeamMemberSlug } from "@/modules/team/queries";

type ScopedFindFirstDelegate = { findFirst: (args?: unknown) => Promise<unknown> };

async function ensureResumeDocument(
  context: TenantContext,
  resumeDocumentId?: string,
) {
  if (!resumeDocumentId || !featureFlags.hasDatabase || !context.companyId) {
    return null;
  }

  const document = (await findFirstForTenant(
    prisma.document as ScopedFindFirstDelegate,
    context,
    {
      where: {
        id: resumeDocumentId,
        visibility: "PRIVATE",
      },
      select: {
        id: true,
      },
    } as Parameters<typeof prisma.document.findFirst>[0],
  )) as { id: string } | null;

  if (!document) {
    throw new Error("Selected resume document is invalid for this tenant.");
  }

  return document.id;
}

function buildTeamMemberData(
  input: TeamMemberMutationInput,
  slug: string,
  resumeDocumentId?: string | null,
) {
  return {
    fullName: input.fullName,
    slug,
    title: input.title,
    bio: input.bio,
    avatarUrl: input.avatarUrl,
    email: input.email,
    phone: input.phone,
    whatsappNumber: input.whatsappNumber,
    staffCode: input.staffCode,
    officeLocation: input.officeLocation,
    resumeDocumentId: resumeDocumentId ?? null,
    profileHighlights: input.profileHighlights,
    portfolioText: input.portfolioText,
    portfolioLinks: input.portfolioLinks,
    socialLinks: input.socialLinks,
    specialties: input.specialties,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
    isPublished: input.isPublished,
  };
}

export function canTenantAdminManageTeamProfiles(context: TenantContext) {
  return !context.isSuperAdmin && hasRequiredRole(context.roles, ["ADMIN"]);
}

function assertTenantAdminCanManageTeam(context: TenantContext) {
  if (!canTenantAdminManageTeamProfiles(context)) {
    throw new Error("Only tenant admins may manage staff profiles.");
  }
}

export async function createTeamMemberForAdmin(
  context: TenantContext,
  rawInput: TeamMemberMutationInput & Record<string, unknown>,
) {
  assertTenantAdminCanManageTeam(context);
  rejectUnsafeCompanyIdInput(rawInput);

  if (!featureFlags.hasDatabase || !context.companyId) {
    return {
      id: "demo-marketer",
      slug: rawInput.slug ?? "demo-marketer",
    };
  }

  const resumeDocumentId = await ensureResumeDocument(context, rawInput.resumeDocumentId);
  const slug = rawInput.slug || (await buildUniqueTeamMemberSlug(context.companyId, rawInput.fullName));

  const created = await prisma.teamMember.create({
    data: {
      companyId: context.companyId,
      ...buildTeamMemberData(rawInput, slug, resumeDocumentId),
    },
    select: {
      id: true,
      slug: true,
      fullName: true,
    },
  });

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId ?? undefined,
    action: "CREATE",
    entityType: "TeamMember",
    entityId: created.id,
    summary: `Created marketer profile ${created.fullName}`,
    payload: {
      slug: created.slug,
    } as Prisma.InputJsonValue,
  });

  return created;
}

export async function updateTeamMemberForAdmin(
  context: TenantContext,
  marketerId: string,
  rawInput: TeamMemberMutationInput & Record<string, unknown>,
) {
  assertTenantAdminCanManageTeam(context);
  rejectUnsafeCompanyIdInput(rawInput);

  if (!featureFlags.hasDatabase || !context.companyId) {
    return {
      id: marketerId,
      slug: rawInput.slug ?? "demo-marketer",
    };
  }

  const existing = (await findFirstForTenant(
    prisma.teamMember as ScopedFindFirstDelegate,
    context,
    {
      where: {
        id: marketerId,
      },
      select: {
        id: true,
      },
    } as Parameters<typeof prisma.teamMember.findFirst>[0],
  )) as { id: string } | null;

  if (!existing) {
    throw new Error("Marketer profile not found.");
  }

  const resumeDocumentId = await ensureResumeDocument(context, rawInput.resumeDocumentId);
  const slug =
    rawInput.slug || (await buildUniqueTeamMemberSlug(context.companyId, rawInput.fullName, marketerId));

  const updated = await prisma.teamMember.update({
    where: {
      id: marketerId,
    },
    data: buildTeamMemberData(rawInput, slug, resumeDocumentId),
    select: {
      id: true,
      slug: true,
      fullName: true,
    },
  });

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId ?? undefined,
    action: "UPDATE",
    entityType: "TeamMember",
    entityId: updated.id,
    summary: `Updated marketer profile ${updated.fullName}`,
    payload: {
      slug: updated.slug,
    } as Prisma.InputJsonValue,
  });

  return updated;
}
