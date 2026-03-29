import type { AppRole } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";

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
  roles: ["SUPER_ADMIN", "ADMIN"],
  companyId: demoCompany.companyId,
  companySlug: demoCompany.companySlug,
  branchId: demoCompany.branchId,
  mode: "demo",
};

export async function getAppSession(
  area: "marketing" | "portal" | "admin" = "marketing",
): Promise<AppSession | null> {
  if (!featureFlags.hasClerk) {
    if (featureFlags.isProduction) {
      return null;
    }

    if (area === "portal") {
      return demoBuyer;
    }

    if (area === "admin") {
      return demoAdmin;
    }

    return null;
  }

  const session = await auth();
  if (!session.userId) {
    return null;
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
