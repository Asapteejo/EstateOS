import type { AppSession } from "@/lib/auth/session";

export function resolveAppLandingPath(session: AppSession | null) {
  if (!session?.userId) {
    return "/app/onboarding";
  }

  if (session.roles.includes("SUPER_ADMIN")) {
    return "/superadmin";
  }

  if (session.roles.includes("ADMIN") && session.companyId) {
    return "/admin";
  }

  if (session.roles.includes("BUYER") && session.companyId) {
    return "/portal";
  }

  return "/app/onboarding";
}
