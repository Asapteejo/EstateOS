import type { AppArea } from "@/lib/auth/session";
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
