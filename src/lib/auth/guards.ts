import { redirect } from "next/navigation";
import type { AppRole } from "@prisma/client";

import { hasRequiredRole } from "@/lib/auth/roles";
import { requireTenantContext } from "@/lib/tenancy/context";

export async function requirePortalSession(options?: {
  redirectOnMissingAuth?: boolean;
}) {
  return requireTenantContext("portal", options);
}

export async function requireBuyerPortalSession(options?: {
  redirectOnMissingAuth?: boolean;
}) {
  const session = await requireTenantContext("portal", options);

  if (!hasRequiredRole(session.roles, ["BUYER"])) {
    if (options?.redirectOnMissingAuth === false) {
      throw new Error("Buyer access is required.");
    }

    if (hasRequiredRole(session.roles, ["SUPER_ADMIN"])) {
      redirect("/superadmin");
    }

    if (hasRequiredRole(session.roles, ["ADMIN", "STAFF", "LEGAL", "FINANCE"])) {
      redirect("/admin");
    }

    redirect("/app/onboarding");
  }

  return session;
}

export async function requireAdminSession(
  requiredRoles?: AppRole[],
  options?: {
    redirectOnMissingAuth?: boolean;
  },
) {
  const session = await requireTenantContext("admin", options);

  if (requiredRoles && !hasRequiredRole(session.roles, requiredRoles)) {
    redirect("/portal");
  }

  return session;
}

export async function requireSuperAdminSession(options?: {
  redirectOnMissingAuth?: boolean;
}) {
  const session = await requireTenantContext("superadmin", options);

  if (!hasRequiredRole(session.roles, ["SUPER_ADMIN"])) {
    redirect("/portal");
  }

  return session;
}
