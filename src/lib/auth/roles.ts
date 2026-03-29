import type { AppRole } from "@prisma/client";

export const buyerRoles: AppRole[] = ["BUYER"];
export const adminRoles: AppRole[] = [
  "STAFF",
  "ADMIN",
  "LEGAL",
  "FINANCE",
  "SUPER_ADMIN",
];

export function hasRequiredRole(
  userRoles: AppRole[],
  required: AppRole | AppRole[],
) {
  const requiredRoles = Array.isArray(required) ? required : [required];
  return requiredRoles.some((role) => userRoles.includes(role));
}
