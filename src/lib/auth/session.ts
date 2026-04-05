import type { AppRole } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

import { featureFlags } from "@/lib/env";

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

function isDemoSessionRole(value: string | undefined | null): value is DemoSessionRole {
  return value === "buyer" || value === "admin" || value === "superadmin";
}

export function buildDemoSession(role: DemoSessionRole): AppSession {
  if (role === "superadmin") {
    return demoSuperAdmin;
  }

  if (role === "admin") {
    return demoAdmin;
  }

  return demoBuyer;
}

export function getDefaultDemoSessionRole(
  area: "marketing" | "portal" | "admin" | "superadmin",
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
  area: "marketing" | "portal" | "admin" | "superadmin",
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

export async function getAppSession(
  area: "marketing" | "portal" | "admin" | "superadmin" = "marketing",
): Promise<AppSession | null> {
  if (!featureFlags.hasClerk) {
    const role = await resolveDemoSessionRole(area);
    return role ? buildDemoSession(role) : null;
  }

  const session = await auth();
  if (!session.userId) {
    const role = await resolveDemoSessionRole(area);
    return role ? buildDemoSession(role) : null;
  }

  const metadata =
    (session.sessionClaims?.metadata as
      | {
          roles?: AppRole[];
          companyId?: string;
          companySlug?: string;
          branchId?: string;
        }
      | undefined) ?? {};

  return {
    userId: session.userId,
    email: (session.sessionClaims?.email as string | undefined) ?? "",
    firstName: (session.sessionClaims?.first_name as string | undefined) ?? "",
    lastName: (session.sessionClaims?.last_name as string | undefined) ?? "",
    roles: metadata.roles ?? ["BUYER"],
    companyId: metadata.companyId ?? null,
    companySlug: metadata.companySlug ?? null,
    branchId: metadata.branchId ?? null,
    mode: "clerk",
  };
}
