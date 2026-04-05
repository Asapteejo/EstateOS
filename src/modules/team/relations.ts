import { prisma } from "@/lib/db/prisma";

type StaffProfileLinkRow = {
  id: string;
  teamMemberId: string | null;
  staffCode: string | null;
  user: {
    email: string;
  };
};

function normalizeLooseString(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function findMatchingStaffProfileId(
  teamMember: {
    email?: string | null;
    staffCode?: string | null;
  },
  staffProfiles: StaffProfileLinkRow[],
) {
  const emailKey = normalizeLooseString(teamMember.email);
  const staffCodeKey = normalizeLooseString(teamMember.staffCode);

  const emailMatches = emailKey
    ? staffProfiles.filter((profile) => normalizeLooseString(profile.user.email) === emailKey)
    : [];
  if (emailMatches.length === 1) {
    return emailMatches[0].id;
  }

  const staffCodeMatches = staffCodeKey
    ? staffProfiles.filter((profile) => normalizeLooseString(profile.staffCode) === staffCodeKey)
    : [];
  if (staffCodeMatches.length === 1) {
    return staffCodeMatches[0].id;
  }

  return null;
}

export async function syncTeamMemberStaffProfileLink(input: {
  companyId: string;
  teamMemberId: string;
  email?: string | null;
  staffCode?: string | null;
}) {
  const existing = await prisma.staffProfile.findFirst({
    where: {
      teamMemberId: input.teamMemberId,
      user: {
        companyId: input.companyId,
      },
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    return existing.id;
  }

  const candidates = await prisma.staffProfile.findMany({
    where: {
      user: {
        companyId: input.companyId,
      },
      OR: [
        { teamMemberId: null },
        { teamMemberId: input.teamMemberId },
      ],
    },
    select: {
      id: true,
      teamMemberId: true,
      staffCode: true,
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  const matchedStaffProfileId = findMatchingStaffProfileId(
    {
      email: input.email,
      staffCode: input.staffCode,
    },
    candidates,
  );

  if (!matchedStaffProfileId) {
    return null;
  }

  await prisma.staffProfile.update({
    where: {
      id: matchedStaffProfileId,
    },
    data: {
      teamMemberId: input.teamMemberId,
    },
    select: {
      id: true,
    },
  });

  return matchedStaffProfileId;
}
