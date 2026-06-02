export const TENANT_ADMIN_ROLE = "ADMIN" as const;

export type ProvisionTenantAdminInput = {
  companySlug: string;
  email: string;
  name: string;
};

function readFlag(args: string[], name: string) {
  const index = args.indexOf(name);
  return index >= 0
    ? args[index + 1]
    : args.find((arg) => arg.startsWith(`${name}=`))?.slice(`${name}=`.length);
}

export function parseProvisionTenantAdminArgs(args: string[]): ProvisionTenantAdminInput {
  const companySlug = readFlag(args, "--companySlug")?.trim().toLowerCase();
  const email = readFlag(args, "--email")?.trim().toLowerCase();
  const name = readFlag(args, "--name")?.trim();

  if (!companySlug || !email?.includes("@") || !name) {
    throw new Error(
      "Usage: npm run provision:tenant-admin -- --companySlug blueprint-urban-residences --email admin@example.com --name \"Admin Name\"",
    );
  }

  return { companySlug, email, name };
}

export function splitProvisionedName(name: string) {
  const [firstName, ...rest] = name.trim().split(/\s+/);
  return {
    firstName: firstName ?? "",
    lastName: rest.join(" "),
  };
}

export function buildManualTenantAdminUser(input: ProvisionTenantAdminInput) {
  const names = splitProvisionedName(input.name);
  return {
    clerkUserId: `manual:${input.email}`,
    email: input.email,
    firstName: names.firstName,
    lastName: names.lastName,
    isActive: true,
  };
}

export function assertProvisioningCompanyMatch(
  existingCompanyId: string | null | undefined,
  targetCompanyId: string,
) {
  if (existingCompanyId && existingCompanyId !== targetCompanyId) {
    throw new Error("Refusing to move an existing user from another tenant.");
  }
}

export function assertProvisioningCompanyExists<T>(company: T | null, companySlug: string): T {
  if (!company) {
    throw new Error(`Company not found for slug "${companySlug}".`);
  }
  return company;
}
