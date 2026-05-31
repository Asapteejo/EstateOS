import type { AppRole } from "@prisma/client";
import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/db/prisma";
import { env, featureFlags } from "@/lib/env";
import { syncAuthenticatedClerkUser } from "@/lib/auth/clerk-user-sync";
import { sanitizeSessionRoles } from "@/lib/auth/superadmin";
import { buildSafeErrorLogContext, logError, logInfo, logWarn } from "@/lib/ops/logger";

export type AppArea = "marketing" | "portal" | "admin" | "superadmin";

export type AppSession = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: AppRole[];
  companyId: string | null;
  companySlug: string | null;
  branchId: string | null;
  mode: "clerk" | "demo";
};

export type DemoSessionRole = "buyer" | "admin" | "superadmin";
export const DEV_SESSION_COOKIE = "estateos_dev_role";
export const DEV_SESSION_COMPANY_ID_COOKIE = "estateos_dev_company_id";
export const DEV_SESSION_COMPANY_SLUG_COOKIE = "estateos_dev_company_slug";
export const DEV_SESSION_BRANCH_ID_COOKIE = "estateos_dev_branch_id";

const demoCompany = {
  companyId: "demo-company-acme",
  companySlug: "acme-realty",
  branchId: "demo-branch-lagos-hq",
};

const demoBuyer: AppSession = {
  userId: "demo-buyer",
  email: "buyer@acmerealty.dev",
  firstName: "Ada",
  lastName: "Okafor",
  roles: ["BUYER"],
  ...demoCompany,
  mode: "demo",
};

const demoAdmin: AppSession = {
  userId: "demo-admin",
  email: "admin@acmerealty.dev",
  firstName: "Tobi",
  lastName: "Adewale",
  roles: ["ADMIN"],
  companyId: demoCompany.companyId,
  companySlug: demoCompany.companySlug,
  branchId: demoCompany.branchId,
  mode: "demo",
};

const demoSuperAdmin: AppSession = {
  userId: "demo-superadmin",
  email: "owner@estateos.dev",
  firstName: "Maya",
  lastName: "Cole",
  roles: ["SUPER_ADMIN"],
  companyId: demoCompany.companyId,
  companySlug: demoCompany.companySlug,
  branchId: demoCompany.branchId,
  mode: "demo",
};

type DemoCompanyContext = {
  companyId: string | null;
  companySlug: string | null;
  branchId: string | null;
};

function isDemoSessionRole(value: string | undefined | null): value is DemoSessionRole {
  return value === "buyer" || value === "admin" || value === "superadmin";
}

export function buildDemoSession(
  role: DemoSessionRole,
  company: DemoCompanyContext = demoCompany,
): AppSession {
  if (role === "superadmin") {
    return {
      ...demoSuperAdmin,
      companyId: company.companyId,
      companySlug: company.companySlug,
      branchId: company.branchId,
    };
  }

  if (role === "admin") {
    return {
      ...demoAdmin,
      companyId: company.companyId,
      companySlug: company.companySlug,
      branchId: company.branchId,
    };
  }

  return {
    ...demoBuyer,
    companyId: company.companyId,
    companySlug: company.companySlug,
    branchId: company.branchId,
  };
}

export function buildFallbackDemoCompanyContext(
  cookies: Partial<DemoCompanyContext> = {},
): DemoCompanyContext {
  return {
    companyId: cookies.companyId ?? demoCompany.companyId,
    companySlug: cookies.companySlug ?? demoCompany.companySlug,
    branchId: cookies.branchId ?? demoCompany.branchId,
  };
}

export function resolveDemoCompanyContextAfterDbError({
  error,
  isProduction,
  cookieCompanyId,
  cookieCompanySlug,
  cookieBranchId,
}: {
  error: unknown;
  isProduction: boolean;
  cookieCompanyId: string | null;
  cookieCompanySlug: string | null;
  cookieBranchId: string | null;
}): DemoCompanyContext {
  if (isProduction) {
    throw error;
  }

  const errorName = error instanceof Error ? error.name : typeof error;
  const errorCode =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code)
      : null;

  logWarn("Demo company context database lookup failed; using local fallback.", {
    area: "dev-session",
    errorName,
    errorCode,
  });

  return buildFallbackDemoCompanyContext({
    companyId: cookieCompanyId,
    companySlug: cookieCompanySlug,
    branchId: cookieBranchId,
  });
}

export function getDefaultDemoSessionRole(
  area: AppArea,
): DemoSessionRole | null {
  if (area === "superadmin") {
    return "superadmin";
  }

  if (area === "admin") {
    return "admin";
  }

  if (area === "portal") {
    return "buyer";
  }

  return null;
}

export async function resolveDemoSessionRole(
  area: AppArea,
): Promise<DemoSessionRole | null> {
  const defaultRole = getDefaultDemoSessionRole(area);

  if (!featureFlags.allowDevBypass) {
    return null;
  }

  const cookieStore = await cookies();
  const cookieRole = cookieStore.get(DEV_SESSION_COOKIE)?.value;

  if (area === "superadmin") {
    return "superadmin";
  }

  if (area === "admin") {
    return cookieRole === "superadmin" ? "superadmin" : "admin";
  }

  if (area === "portal") {
    return "buyer";
  }

  if (isDemoSessionRole(cookieRole)) {
    return cookieRole;
  }

  return defaultRole;
}

async function resolveDemoCompanyContext() {
  const cookieStore = await cookies();
  const cookieCompanyId = cookieStore.get(DEV_SESSION_COMPANY_ID_COOKIE)?.value ?? null;
  const cookieCompanySlug = cookieStore.get(DEV_SESSION_COMPANY_SLUG_COOKIE)?.value ?? null;
  const cookieBranchId = cookieStore.get(DEV_SESSION_BRANCH_ID_COOKIE)?.value ?? null;

  if (!featureFlags.hasDatabase) {
    return buildFallbackDemoCompanyContext({
      companyId: cookieCompanyId,
      companySlug: cookieCompanySlug,
      branchId: cookieBranchId,
    });
  }

  try {
    const company =
      (cookieCompanyId
        ? await prisma.company.findUnique({
            where: { id: cookieCompanyId },
            select: {
              id: true,
              slug: true,
              branches: {
                select: { id: true },
                take: 1,
                orderBy: { createdAt: "asc" },
              },
            },
          })
        : null) ??
      (cookieCompanySlug
        ? await prisma.company.findFirst({
            where: {
              OR: [{ slug: cookieCompanySlug }, { subdomain: cookieCompanySlug }],
            },
            select: {
              id: true,
              slug: true,
              branches: {
                select: { id: true },
                take: 1,
                orderBy: { createdAt: "asc" },
              },
            },
          })
        : null) ??
      (env.DEFAULT_COMPANY_SLUG
        ? await prisma.company.findFirst({
            where: {
              OR: [
                { slug: env.DEFAULT_COMPANY_SLUG },
                { subdomain: env.DEFAULT_COMPANY_SLUG },
              ],
            },
            select: {
              id: true,
              slug: true,
              branches: {
                select: { id: true },
                take: 1,
                orderBy: { createdAt: "asc" },
              },
            },
          })
        : null) ??
      (await prisma.company.findFirst({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          slug: true,
          branches: {
            select: { id: true },
            take: 1,
            orderBy: { createdAt: "asc" },
          },
        },
      }));

    if (company) {
      return {
        companyId: company.id,
        companySlug: company.slug,
        branchId: cookieBranchId ?? company.branches[0]?.id ?? null,
      };
    }

    return buildFallbackDemoCompanyContext({
      companyId: cookieCompanyId,
      companySlug: cookieCompanySlug,
      branchId: cookieBranchId,
    });
  } catch (error) {
    return resolveDemoCompanyContextAfterDbError({
      error,
      isProduction: featureFlags.isProduction,
      cookieCompanyId,
      cookieCompanySlug,
      cookieBranchId,
    });
  }
}

export async function getPreferredTenantSiteCompanySlug() {
  const company = await resolveDemoCompanyContext();

  if (!company.companyId || !company.companySlug) {
    return null;
  }

  if (featureFlags.hasDatabase && company.companyId === demoCompany.companyId) {
    return null;
  }

  return company.companySlug;
}

export async function getAppSession(
  area: AppArea = "marketing",
): Promise<AppSession | null> {
  if (!featureFlags.hasClerk) {
    const role = await resolveDemoSessionRole(area);
    const company = await resolveDemoCompanyContext();
    return role ? buildDemoSession(role, company) : null;
  }

  const session = await auth();
  if (!session.userId) {
    const role = await resolveDemoSessionRole(area);
    const company = await resolveDemoCompanyContext();
    return role ? buildDemoSession(role, company) : null;
  }

  if (featureFlags.hasDatabase) {
    const findPersistedUser = () =>
      prisma.user.findUnique({
      where: {
        clerkUserId: session.userId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        companyId: true,
        branchId: true,
        company: {
          select: {
            slug: true,
          },
        },
        roles: {
          select: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      });

    const findPersistedUserWithLogging = async () => {
      try {
        return await findPersistedUser();
      } catch (error) {
        logError("Authenticated application user lookup failed.", {
          area,
          step: "database-user-lookup",
          clerkUserIdPresent: true,
          ...buildSafeErrorLogContext(error),
        });
        throw error;
      }
    };

    let user = await findPersistedUserWithLogging();
    if (!user) {
      logWarn("Authenticated Clerk identity is missing a persisted user row.", {
        area,
        step: "database-user-lookup",
        clerkUserIdPresent: true,
        dbUserFound: false,
      });

      try {
        const clerkUser = await currentUser();
        const primaryEmail =
          clerkUser?.emailAddresses.find(
            (address) => address.id === clerkUser.primaryEmailAddressId,
          ) ?? clerkUser?.emailAddresses[0];
        const primaryPhone =
          clerkUser?.phoneNumbers.find(
            (phone) => phone.id === clerkUser.primaryPhoneNumberId,
          ) ?? clerkUser?.phoneNumbers[0];

        if (clerkUser?.id === session.userId && primaryEmail?.emailAddress) {
          const syncResult = await syncAuthenticatedClerkUser({
            clerkUserId: session.userId,
            email: primaryEmail.emailAddress,
            firstName: clerkUser.firstName,
            lastName: clerkUser.lastName,
            phone: primaryPhone?.phoneNumber,
          });
          logInfo("Synchronized authenticated Clerk identity on first login.", {
            area,
            step: "first-login-user-sync",
            outcome: syncResult.outcome,
          });
          user = await findPersistedUserWithLogging();
        } else {
          logWarn("Skipped first-login user sync because Clerk identity details are incomplete.", {
            area,
            step: "first-login-user-sync",
            clerkUserIdPresent: Boolean(clerkUser?.id),
            clerkEmailPresent: Boolean(primaryEmail?.emailAddress),
          });
        }
      } catch (error) {
        logError("First-login Clerk user sync failed.", {
          area,
          step: "first-login-user-sync",
          ...buildSafeErrorLogContext(error),
        });
        user = await findPersistedUserWithLogging();
      }
    }

    if (user) {
      const roles = sanitizeSessionRoles({
        roles: user.roles.map((assignment) => assignment.role.name),
        email: user.email,
        isProduction: featureFlags.isProduction,
        superadminEmails: env.SUPERADMIN_EMAILS,
        source: "database",
      });
      logInfo("Resolved authenticated application session.", {
        area,
        step: "session-resolved",
        clerkUserIdPresent: true,
        clerkEmailPresent: Boolean(user.email),
        dbUserFound: true,
        rolesFound: roles,
        companyIdResolved: Boolean(user.companyId),
      });
      return {
        userId: session.userId,
        email: user.email,
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
        roles,
        companyId: user.companyId ?? null,
        companySlug: user.company?.slug ?? null,
        branchId: user.branchId ?? null,
        mode: "clerk",
      };
    }
  }

  logWarn("Authenticated Clerk identity could not be resolved to a persisted application user.", {
    area,
    step: "session-fallback",
    clerkUserIdPresent: true,
    clerkEmailPresent: Boolean(session.sessionClaims?.email),
    dbUserFound: false,
    rolesFound: [],
    companyIdResolved: false,
  });
  return {
    userId: session.userId,
    email: (session.sessionClaims?.email as string | undefined) ?? "",
    firstName: (session.sessionClaims?.first_name as string | undefined) ?? "",
    lastName: (session.sessionClaims?.last_name as string | undefined) ?? "",
    roles: [],
    companyId: null,
    companySlug: null,
    branchId: null,
    mode: "clerk",
  };
}
