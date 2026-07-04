import type { AppArea } from "@/lib/auth/session";
import type { AppRole } from "@prisma/client";
import { adminRoles, buyerRoles, hasRequiredRole } from "@/lib/auth/roles";
import { adminLandingPath } from "@/lib/auth/admin-sections";
import { isSuperadminEmailAllowlisted } from "@/lib/auth/superadmin";
import { env } from "@/lib/env";

type AuthenticatedSetupRedirectInput = {
  area: AppArea;
  roles: string[];
  companyId: string | null;
  email: string;
  superadminEmails?: string | null;
};

export function resolveAuthenticatedSetupRedirect({
  area,
  roles,
  companyId,
  email,
  superadminEmails = env.SUPERADMIN_EMAILS,
}: AuthenticatedSetupRedirectInput) {
  if (area === "superadmin") {
    if (roles.includes("SUPER_ADMIN") && isSuperadminEmailAllowlisted(email, superadminEmails)) {
      return null;
    }
    return isSuperadminEmailAllowlisted(email, superadminEmails)
      ? "/app/access?status=superadmin-setup"
      : "/app/access?status=forbidden";
  }

  if (roles.length === 0 || !companyId) {
    return "/app/onboarding";
  }

  return null;
}

export type TenantEntryIntent = "admin" | "buyer" | "purchase";

export type TenantEntrySession = {
  email?: string | null;
  companyId: string | null;
  roles: AppRole[];
};

export type TenantEntryTarget = {
  companyId: string;
};

export function defaultDashboardForRoles(roles: AppRole[]) {
  if (hasRequiredRole(roles, ["SUPER_ADMIN"])) {
    return "/superadmin";
  }

  if (hasRequiredRole(roles, adminRoles)) {
    return adminLandingPath(roles);
  }

  if (hasRequiredRole(roles, buyerRoles)) {
    return "/portal";
  }

  return "/app/onboarding";
}

export function canAccessTenantEntry(input: {
  entry: TenantEntryIntent;
  session: TenantEntrySession | null;
  target: TenantEntryTarget | null;
}) {
  if (!input.session || !input.target) {
    return false;
  }

  if (input.session.companyId !== input.target.companyId) {
    return false;
  }

  if (input.entry === "admin") {
    return hasRequiredRole(input.session.roles, adminRoles);
  }

  return hasRequiredRole(input.session.roles, buyerRoles);
}
