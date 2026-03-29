import { redirect } from "next/navigation";
import type { AppRole } from "@prisma/client";

import { hasRequiredRole } from "@/lib/auth/roles";
import { requireTenantContext } from "@/lib/tenancy/context";

export async function requirePortalSession(options?: {
  redirectOnMissingAuth?: boolean;
}) {
  return requireTenantContext("portal", options);
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
