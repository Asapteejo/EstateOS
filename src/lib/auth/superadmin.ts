import type { AppRole } from "@prisma/client";

export function parseSuperadminEmails(value: string | undefined | null) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isSuperadminEmailAllowlisted(
  email: string | undefined | null,
  allowlist: string | undefined | null,
) {
  const normalizedEmail = email?.trim().toLowerCase();
  return Boolean(normalizedEmail && parseSuperadminEmails(allowlist).has(normalizedEmail));
}

export function sanitizeSessionRoles(input: {
  roles: AppRole[];
  email?: string | null;
  isProduction: boolean;
  superadminEmails?: string | null;
  source: "database" | "claims" | "demo";
}) {
  if (!input.roles.includes("SUPER_ADMIN")) {
    return input.roles;
  }

  if (input.source === "claims") {
    return input.roles.filter((role) => role !== "SUPER_ADMIN");
  }

  if (!input.isProduction && input.source === "demo") {
    return input.roles;
  }

  return isSuperadminEmailAllowlisted(input.email, input.superadminEmails)
    ? input.roles
    : input.roles.filter((role) => role !== "SUPER_ADMIN");
}

export function canAccessSuperadmin(input: {
  roles: AppRole[];
  email?: string | null;
  isProduction: boolean;
  superadminEmails?: string | null;
  mode: "clerk" | "demo";
}) {
  if (!input.roles.includes("SUPER_ADMIN")) {
    return false;
  }

  if (!input.isProduction) {
    return input.mode === "demo" || isSuperadminEmailAllowlisted(input.email, input.superadminEmails);
  }

  return input.mode === "clerk" && isSuperadminEmailAllowlisted(input.email, input.superadminEmails);
}
