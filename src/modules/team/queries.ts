import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import type { TenantContext } from "@/lib/tenancy/context";
import { findFirstForTenant, findManyForTenant } from "@/lib/tenancy/db";
import { slugify } from "@/lib/utils";
import { teamMembers as demoTeamMembers } from "@/modules/cms/demo-data";

type ScopedFindManyDelegate = { findMany: (args?: unknown) => Promise<unknown> };
type ScopedFindFirstDelegate = { findFirst: (args?: unknown) => Promise<unknown> };

export type TeamMemberManagementRecord = {
  id: string;
  fullName: string;
  slug: string;
  title: string;
  bio: string;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  staffCode: string | null;
  officeLocation: string | null;
  resumeDocumentId: string | null;
  profileHighlights: string[];
  portfolioText: string | null;
  portfolioLinks: string[];
  socialLinks: string[];
  specialties: string[];
  sortOrder: number;
  isActive: boolean;
  isPublished: boolean;
};

export type VisibleMarketerProfile = {
  id: string;
  fullName: string;
  slug: string;
  title: string;
  bio: string;
  avatarUrl: string | null;
  whatsappNumber: string | null;
  email: string | null;
  phone: string | null;
  staffCode: string | null;
  officeLocation: string | null;
  specialties: string[];
  profileHighlights: string[];
  portfolioText: string | null;
  portfolioLinks: string[];
  socialLinks: string[];
};

function parseStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

export function isVisibleTeamMemberRecord(input: {
  isActive: boolean;
  isPublished: boolean;
}) {
  return input.isActive && input.isPublished;
}

export async function getAdminTeamMembers(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return [] as TeamMemberManagementRecord[];
  }

  const rows = (await findManyForTenant(
    prisma.teamMember as ScopedFindManyDelegate,
    context,
    {
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        fullName: true,
        slug: true,
        title: true,
        bio: true,
        avatarUrl: true,
        email: true,
        phone: true,
        whatsappNumber: true,
        staffCode: true,
        officeLocation: true,
        resumeDocumentId: true,
        profileHighlights: true,
        portfolioText: true,
        portfolioLinks: true,
        socialLinks: true,
        specialties: true,
        sortOrder: true,
        isActive: true,
        isPublished: true,
      },
    } as Parameters<typeof prisma.teamMember.findMany>[0],
  )) as Array<{
    id: string;
    fullName: string;
    slug: string;
    title: string;
    bio: string;
    avatarUrl: string | null;
    email: string | null;
    phone: string | null;
    whatsappNumber: string | null;
    staffCode: string | null;
    officeLocation: string | null;
    resumeDocumentId: string | null;
    profileHighlights: unknown;
    portfolioText: string | null;
    portfolioLinks: unknown;
    socialLinks: unknown;
    specialties: unknown;
    sortOrder: number;
    isActive: boolean;
    isPublished: boolean;
  }>;

  return rows.map((row) => ({
    ...row,
    profileHighlights: parseStringArray(row.profileHighlights),
    portfolioLinks: parseStringArray(row.portfolioLinks),
    socialLinks: parseStringArray(row.socialLinks),
    specialties: parseStringArray(row.specialties),
  }));
}

export async function getVisibleTeamMembers(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return demoTeamMembers.map((member) => ({
      id: member.slug,
      fullName: member.fullName,
      slug: member.slug,
      title: member.title,
      bio: member.bio,
      avatarUrl: member.image,
      whatsappNumber: member.phone,
      email: member.email,
      phone: member.phone,
      staffCode: null,
      officeLocation: null,
      specialties: [],
      profileHighlights: [],
      portfolioText: null,
      portfolioLinks: [],
      socialLinks: [],
    }));
  }

  const rows = (await findManyForTenant(
    prisma.teamMember as ScopedFindManyDelegate,
    context,
    {
      where: {
        isPublished: true,
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        fullName: true,
        slug: true,
        title: true,
        bio: true,
        avatarUrl: true,
        whatsappNumber: true,
        email: true,
        phone: true,
        staffCode: true,
        officeLocation: true,
        profileHighlights: true,
        portfolioText: true,
        portfolioLinks: true,
        socialLinks: true,
        specialties: true,
      },
    } as Parameters<typeof prisma.teamMember.findMany>[0],
  )) as Array<{
    id: string;
    fullName: string;
    slug: string;
    title: string;
    bio: string;
    avatarUrl: string | null;
    whatsappNumber: string | null;
    email: string | null;
    phone: string | null;
    staffCode: string | null;
    officeLocation: string | null;
    profileHighlights: unknown;
    portfolioText: string | null;
    portfolioLinks: unknown;
    socialLinks: unknown;
    specialties: unknown;
  }>;

  return rows.map((row) => ({
    ...row,
    profileHighlights: parseStringArray(row.profileHighlights),
    portfolioLinks: parseStringArray(row.portfolioLinks),
    socialLinks: parseStringArray(row.socialLinks),
    specialties: parseStringArray(row.specialties),
  }));
}

export async function getVisibleTeamMemberBySlug(
  context: TenantContext,
  slug: string,
) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    const member = demoTeamMembers.find((entry) => entry.slug === slug);
    if (!member) {
      return null;
    }

    return {
      id: member.slug,
      slug: member.slug,
      fullName: member.fullName,
      title: member.title,
      bio: member.bio,
      avatarUrl: member.image,
      whatsappNumber: member.phone,
      email: member.email,
      phone: member.phone,
      staffCode: null,
      officeLocation: null,
      specialties: [],
      profileHighlights: [],
      portfolioText: null,
      portfolioLinks: [],
      socialLinks: [],
    };
  }

  const row = (await findFirstForTenant(
    prisma.teamMember as ScopedFindFirstDelegate,
    context,
    {
      where: {
        slug,
        isPublished: true,
        isActive: true,
      },
      select: {
        id: true,
        slug: true,
        fullName: true,
        title: true,
        bio: true,
        avatarUrl: true,
        whatsappNumber: true,
        email: true,
        phone: true,
        staffCode: true,
        officeLocation: true,
        profileHighlights: true,
        portfolioText: true,
        portfolioLinks: true,
        socialLinks: true,
        specialties: true,
      },
    } as Parameters<typeof prisma.teamMember.findFirst>[0],
  )) as {
    id: string;
    slug: string;
    fullName: string;
    title: string;
    bio: string;
    avatarUrl: string | null;
    whatsappNumber: string | null;
    email: string | null;
    phone: string | null;
    staffCode: string | null;
    officeLocation: string | null;
    profileHighlights: unknown;
    portfolioText: string | null;
    portfolioLinks: unknown;
    socialLinks: unknown;
    specialties: unknown;
  } | null;

  if (!row) {
    return null;
  }

  return {
    ...row,
    profileHighlights: parseStringArray(row.profileHighlights),
    portfolioLinks: parseStringArray(row.portfolioLinks),
    socialLinks: parseStringArray(row.socialLinks),
    specialties: parseStringArray(row.specialties),
  };
}

export async function ensureVisibleTeamMember(
  context: TenantContext,
  marketerId?: string | null,
) {
  if (!marketerId || !featureFlags.hasDatabase || !context.companyId) {
    return null;
  }

  return (await findFirstForTenant(
    prisma.teamMember as ScopedFindFirstDelegate,
    context,
    {
      where: {
        id: marketerId,
        isPublished: true,
        isActive: true,
      },
      select: {
        id: true,
      },
    } as Parameters<typeof prisma.teamMember.findFirst>[0],
  )) as { id: string } | null;
}

export async function ensureTeamMemberForAdmin(
  context: TenantContext,
  marketerId: string,
) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return null;
  }

  return (await findFirstForTenant(
    prisma.teamMember as ScopedFindFirstDelegate,
    context,
    {
      where: {
        id: marketerId,
      },
      select: {
        id: true,
        slug: true,
      },
    } as Parameters<typeof prisma.teamMember.findFirst>[0],
  )) as { id: string; slug: string } | null;
}

export async function getAvailableResumeDocuments(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return [] as Array<{ id: string; fileName: string }>;
  }

  return (await findManyForTenant(
    prisma.document as ScopedFindManyDelegate,
    context,
    {
      where: {
        visibility: "PRIVATE",
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        fileName: true,
      },
    } as Parameters<typeof prisma.document.findMany>[0],
  )) as Array<{ id: string; fileName: string }>;
}

export async function buildUniqueTeamMemberSlug(
  companyId: string,
  fullName: string,
  existingId?: string,
) {
  const baseSlug = slugify(fullName);
  const rows = await prisma.teamMember.findMany({
    where: {
      companyId,
      slug: {
        startsWith: baseSlug,
      },
      ...(existingId ? { id: { not: existingId } } : {}),
    },
    select: {
      slug: true,
    },
  });

  if (!rows.some((row) => row.slug === baseSlug)) {
    return baseSlug;
  }

  let suffix = rows.length + 1;
  let next = `${baseSlug}-${suffix}`;
  while (rows.some((row) => row.slug === next)) {
    suffix += 1;
    next = `${baseSlug}-${suffix}`;
  }

  return next;
}
