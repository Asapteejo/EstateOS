import type { AppSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { logInfo } from "@/lib/ops/logger";
import { type TenantContext } from "@/lib/tenancy/context";
import { loadSampleWorkspaceForTenant } from "@/modules/admin/sample-workspace";

function slugifyCompanyName(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function buildUniqueCompanySlug(name: string, preferredSlug?: string | null) {
  const baseSlug = slugifyCompanyName(preferredSlug?.trim() || name);
  const existing = await prisma.company.findMany({
    where: {
      slug: {
        startsWith: baseSlug,
      },
    },
    select: {
      slug: true,
    },
  });

  if (!existing.some((company) => company.slug === baseSlug)) {
    return baseSlug;
  }

  let suffix = existing.length + 1;
  let nextSlug = `${baseSlug}-${suffix}`;
  while (existing.some((company) => company.slug === nextSlug)) {
    suffix += 1;
    nextSlug = `${baseSlug}-${suffix}`;
  }

  return nextSlug;
}

async function ensureCompanyRoles(companyId: string) {
  const buyerRole = await prisma.role.upsert({
    where: {
      companyId_name: {
        companyId,
        name: "BUYER",
      },
    },
    update: {
      label: "Buyer",
    },
    create: {
      companyId,
      name: "BUYER",
      label: "Buyer",
    },
    select: {
      id: true,
    },
  });

  const adminRole = await prisma.role.upsert({
    where: {
      companyId_name: {
        companyId,
        name: "ADMIN",
      },
    },
    update: {
      label: "Admin",
    },
    create: {
      companyId,
      name: "ADMIN",
      label: "Admin",
    },
    select: {
      id: true,
    },
  });

  return { buyerRole, adminRole };
}

async function upsertWorkspaceAdmin(input: {
  session: AppSession;
  companyId: string;
  companySlug: string;
  branchId: string;
  adminRoleId: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}) {
  const user = await prisma.user.upsert({
    where: {
      clerkUserId: input.session.userId,
    },
    update: {
      email: input.email ?? input.session.email,
      firstName: input.firstName ?? input.session.firstName,
      lastName: input.lastName ?? input.session.lastName,
      companyId: input.companyId,
      branchId: input.branchId,
      isActive: true,
    },
    create: {
      clerkUserId: input.session.userId,
      email: input.email ?? input.session.email,
      firstName: input.firstName ?? input.session.firstName,
      lastName: input.lastName ?? input.session.lastName,
      companyId: input.companyId,
      branchId: input.branchId,
      isActive: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId_companyId: {
        userId: user.id,
        roleId: input.adminRoleId,
        companyId: input.companyId,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: input.adminRoleId,
      companyId: input.companyId,
    },
  });

  await prisma.staffProfile.upsert({
    where: {
      userId: user.id,
    },
    update: {
      title: "Operations Admin",
      department: "Operations",
      isAssignable: true,
    },
    create: {
      userId: user.id,
      title: "Operations Admin",
      department: "Operations",
      isAssignable: true,
    },
  });

  return user;
}

function buildTenantContext(input: {
  session: AppSession;
  companyId: string;
  companySlug: string;
  branchId: string;
}): TenantContext {
  return {
    userId: input.session.userId,
    companyId: input.companyId,
    companySlug: input.companySlug,
    branchId: input.branchId,
    roles: ["ADMIN"],
    isSuperAdmin: false,
    host: null,
    resolutionSource: "session",
  };
}

export async function createSampleCompany(input: {
  session: AppSession;
  companyName: string;
  slug?: string | null;
  adminFirstName?: string | null;
  adminLastName?: string | null;
  adminEmail?: string | null;
  includeSampleData?: boolean;
}) {
  if (!featureFlags.hasDatabase) {
    throw new Error("Database access is required to create a company.");
  }

  const companySlug = await buildUniqueCompanySlug(input.companyName, input.slug);
  const company = await prisma.company.create({
    data: {
      name: input.companyName,
      slug: companySlug,
      subdomain: companySlug,
      legalName: input.companyName,
      description: "Developer sales workspace created from EstateOS onboarding.",
      primaryColor: "#0e5b49",
      accentColor: "#d3c1a1",
    },
    select: {
      id: true,
      slug: true,
      name: true,
    },
  });

  await prisma.siteSettings.create({
    data: {
      companyId: company.id,
      companyName: company.name,
      supportEmail: input.adminEmail ?? input.session.email,
    },
  });

  const branch = await prisma.branch.create({
    data: {
      companyId: company.id,
      name: "Head Office",
      slug: "head-office",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
    select: {
      id: true,
    },
  });

  const { adminRole } = await ensureCompanyRoles(company.id);
  await upsertWorkspaceAdmin({
    session: input.session,
    companyId: company.id,
    companySlug: company.slug,
    branchId: branch.id,
    adminRoleId: adminRole.id,
    firstName: input.adminFirstName,
    lastName: input.adminLastName,
    email: input.adminEmail,
  });

  if (input.includeSampleData) {
    await loadSampleWorkspaceForTenant(
      buildTenantContext({
        session: input.session,
        companyId: company.id,
        companySlug: company.slug,
        branchId: branch.id,
      }),
    );
  }

  logInfo("Company onboarding completed.", {
    companyId: company.id,
    companySlug: company.slug,
    includeSampleData: input.includeSampleData === true,
  });

  return {
    companyId: company.id,
    companyName: company.name,
    companySlug: company.slug,
    branchId: branch.id,
  };
}

export type OnboardingInput = {
  companyName: string;
  companySlug?: string | null;
  adminFirstName?: string | null;
  adminLastName?: string | null;
  adminEmail?: string | null;
  includeSampleData?: boolean;
};

export async function completeWorkspaceOnboarding(session: AppSession, input: OnboardingInput) {
  if (!featureFlags.hasDatabase) {
    throw new Error("Database access is required to onboard a company.");
  }

  if (!input.companyName.trim()) {
    throw new Error("Company name is required.");
  }

  return createSampleCompany({
    session,
    companyName: input.companyName.trim(),
    slug: input.companySlug?.trim() || null,
    adminFirstName: input.adminFirstName?.trim() || null,
    adminLastName: input.adminLastName?.trim() || null,
    adminEmail: input.adminEmail?.trim() || null,
    includeSampleData: input.includeSampleData === true,
  });
}
