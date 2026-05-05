import { createMockCompanyFromSuperadmin } from "@/modules/superadmin/onboarding";
import type { TenantContext } from "@/lib/tenancy/context";

const context: TenantContext = {
  userId: null,
  companyId: null,
  companySlug: null,
  branchId: null,
  roles: ["SUPER_ADMIN"],
  isSuperAdmin: true,
  host: null,
  resolutionSource: "none",
};

const result = await createMockCompanyFromSuperadmin(context);

console.log("Mock company created");
console.log(`Company ID: ${result.companyId}`);
console.log(`Company slug: ${result.companySlug}`);
console.log(`Owner email: admin+${result.companySlug}@estateos.test`);
