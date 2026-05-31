import type { AppRole } from "@prisma/client";

export function shouldRedirectBuyerToProfileSetup(input: {
  roles: AppRole[];
  profileExists: boolean;
}) {
  return input.roles.includes("BUYER") && !input.profileExists;
}

