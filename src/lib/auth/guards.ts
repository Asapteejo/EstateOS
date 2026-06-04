import { redirect } from "next/navigation";
import type { AppRole } from "@prisma/client";

import { hasRequiredRole } from "@/lib/auth/roles";
import { adminRoles } from "@/lib/auth/roles";
import { requireTenantContext } from "@/lib/tenancy/context";
import { canAccessSuperadmin } from "@/lib/auth/superadmin";
import { env, featureFlags } from "@/lib/env";

export class SuperadminAccessError extends Error {
  constructor() {
    super("Superadmin access is required.");
    this.name = "SuperadminAccessError";
  }
}

export function isSuperadminAccessError(error: unknown): error is SuperadminAccessError {
  return error instanceof SuperadminAccessError;
}

export async function requirePortalSession(options?: {
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

export async function requireBuyerPortalSession(options?: {
  redirectOnMissingAuth?: boolean;
}) {
  return requirePortalSession(options);
}

export async function requireAdminSession(
  requiredRoles?: AppRole[],
  options?: {
    redirectOnMissingAuth?: boolean;
  },
) {
  const session = await requireTenantContext("admin", options);
  const allowedRoles = requiredRoles ?? adminRoles;

  if (!hasRequiredRole(session.roles, allowedRoles)) {
    if (options?.redirectOnMissingAuth === false) {
      throw new Error("Tenant operator access is required.");
    }
    redirect("/portal");
  }

  return session;
}

export async function requireSuperAdminSession(options?: {
  redirectOnMissingAuth?: boolean;
}) {
  const session = await requireTenantContext("superadmin", options);

  if (!canAccessSuperadmin({
    roles: session.roles,
    email: session.email,
    isProduction: featureFlags.isProduction,
    superadminEmails: env.SUPERADMIN_EMAILS,
    mode: session.userId?.startsWith("demo-") ? "demo" : "clerk",
  })) {
    if (options?.redirectOnMissingAuth === false) {
      throw new SuperadminAccessError();
    }
    redirect("/portal");
  }

  return session;
}
