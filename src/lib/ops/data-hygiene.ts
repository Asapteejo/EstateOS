import { parseSuperadminEmails } from "@/lib/auth/superadmin";

export const BLUEPRINT_COMPANY_SLUG = "blueprint-urban-residences";
export const CLEANUP_CONFIRMATION = "CLEAN_DEMO_DATA";
export const KNOWN_DEMO_EMAILS = new Set([
  "admin@acmerealty.dev",
  "buyer@acmerealty.dev",
  "superadmin@estateos.dev",
]);

export type HygieneUser = {
  id: string;
  clerkUserId: string;
  email: string;
  companyId: string | null;
  companySlug?: string | null;
  isActive?: boolean;
};

export type HygieneRoleAssignment = {
  id: string;
  userId: string;
  companyId: string | null;
  roleId: string;
  roleName: string;
  roleCompanyId: string | null;
  user: HygieneUser;
};

export type CleanupMode = {
  apply: boolean;
  confirmation: string | null;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isClearlyDemoUser(user: Pick<HygieneUser, "email" | "clerkUserId">) {
  const email = normalizeEmail(user.email);
  return (
    user.clerkUserId.startsWith("demo-") ||
    user.clerkUserId.startsWith("mock:") ||
    user.clerkUserId.startsWith("sample-") ||
    email.includes(".dev") ||
    email.endsWith("@estateos.test") ||
    KNOWN_DEMO_EMAILS.has(email)
  );
}

export function isBlueprintUser(user: Pick<HygieneUser, "companySlug">) {
  return user.companySlug === BLUEPRINT_COMPANY_SLUG;
}

export function parseCleanupMode(args: string[]): CleanupMode {
  const apply = args.includes("--apply");
  const confirmationIndex = args.indexOf("--confirm");
  const confirmation =
    confirmationIndex >= 0
      ? args[confirmationIndex + 1] ?? null
      : args.find((arg) => arg.startsWith("--confirm="))?.slice("--confirm=".length) ?? null;

  if (apply && confirmation !== CLEANUP_CONFIRMATION) {
    throw new Error(`Apply mode requires --confirm "${CLEANUP_CONFIRMATION}".`);
  }

  return { apply, confirmation };
}

function duplicateRoleIds(assignments: HygieneRoleAssignment[]) {
  const seen = new Set<string>();
  const duplicateIds = new Set<string>();

  for (const assignment of assignments) {
    const key = [assignment.userId, assignment.roleId, assignment.companyId ?? "global"].join(":");
    if (seen.has(key)) duplicateIds.add(assignment.id);
    seen.add(key);
  }

  return duplicateIds;
}

export function buildRoleIntegrityReport(
  assignments: HygieneRoleAssignment[],
  superadminEmails: string | undefined,
) {
  const allowlist = parseSuperadminEmails(superadminEmails);
  const duplicates = duplicateRoleIds(assignments);

  return {
    userCompanyMismatch: assignments.filter(
      (assignment) =>
        assignment.companyId != null && assignment.user.companyId !== assignment.companyId,
    ),
    roleCompanyMismatch: assignments.filter(
      (assignment) => assignment.roleCompanyId !== assignment.companyId,
    ),
    tenantRoleMissingCompany: assignments.filter(
      (assignment) => assignment.roleName !== "SUPER_ADMIN" && assignment.companyId == null,
    ),
    unauthorizedGlobalSuperadmins: assignments.filter(
      (assignment) =>
        assignment.roleName === "SUPER_ADMIN" &&
        assignment.companyId == null &&
        !allowlist.has(normalizeEmail(assignment.user.email)),
    ),
    duplicateAssignments: assignments.filter((assignment) => duplicates.has(assignment.id)),
  };
}

export function buildCleanupPlan(
  assignments: HygieneRoleAssignment[],
  users: HygieneUser[],
  superadminEmails: string | undefined,
) {
  const integrity = buildRoleIntegrityReport(assignments, superadminEmails);
  const roleReasons = new Map<string, Set<string>>();
  const addRole = (assignment: HygieneRoleAssignment, reason: string) => {
    if (isBlueprintUser(assignment.user)) return;
    const reasons = roleReasons.get(assignment.id) ?? new Set<string>();
    reasons.add(reason);
    roleReasons.set(assignment.id, reasons);
  };

  for (const assignment of assignments) {
    if (isClearlyDemoUser(assignment.user)) addRole(assignment, "demo-user-role");
  }
  for (const assignment of integrity.unauthorizedGlobalSuperadmins) {
    addRole(assignment, "unauthorized-global-superadmin");
  }
  for (const assignment of integrity.duplicateAssignments) addRole(assignment, "duplicate-role");
  for (const assignment of integrity.userCompanyMismatch) addRole(assignment, "stale-company-role");
  for (const assignment of integrity.roleCompanyMismatch) addRole(assignment, "role-company-mismatch");
  for (const assignment of integrity.tenantRoleMissingCompany) addRole(assignment, "tenant-role-missing-company");

  return {
    roleAssignments: [...roleReasons.entries()].map(([id, reasons]) => ({
      id,
      reasons: [...reasons],
    })),
    deactivateUsers: users
      .filter((user) => isClearlyDemoUser(user) && !isBlueprintUser(user))
      .map((user) => ({ id: user.id, email: user.email, clerkUserId: user.clerkUserId })),
  };
}

export function assertCleanupAllowlistConfigured(superadminEmails: string | undefined) {
  if (parseSuperadminEmails(superadminEmails).size < 1) {
    throw new Error("Refusing cleanup: SUPERADMIN_EMAILS must contain the platform owner.");
  }
}
