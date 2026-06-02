import type { AppRole } from "@prisma/client";

export type SessionRoleAssignment = {
  companyId: string | null;
  role: {
    companyId: string | null;
    name: AppRole;
  };
};

export function assertCompanyAssignmentAllowed(
  currentCompanyId: string | null | undefined,
  targetCompanyId: string,
) {
  if (currentCompanyId && currentCompanyId !== targetCompanyId) {
    throw new Error("This account already belongs to another company.");
  }
}

export function filterSessionRoleAssignments(
  assignments: SessionRoleAssignment[],
  activeCompanyId: string | null,
) {
  return assignments
    .filter((assignment) => {
      if (assignment.role.name === "SUPER_ADMIN") {
        return assignment.companyId === null && assignment.role.companyId === null;
      }

      return Boolean(
        activeCompanyId &&
          assignment.companyId === activeCompanyId &&
          assignment.role.companyId === activeCompanyId,
      );
    })
    .map((assignment) => assignment.role.name);
}
