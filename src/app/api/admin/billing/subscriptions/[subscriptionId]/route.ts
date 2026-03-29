import { hasRequiredRole } from "@/lib/auth/roles";
import { fail, ok } from "@/lib/http";
import { requireTenantContext } from "@/lib/tenancy/context";
import { companySubscriptionRevocationSchema } from "@/lib/validations/billing";
import { revokeCompanySubscription } from "@/modules/billing/mutations";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ subscriptionId: string }> },
) {
  let tenant: Awaited<ReturnType<typeof requireTenantContext>>;
  try {
    tenant = await requireTenantContext("admin", { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and superadmin access are required.", 401);
  }

  if (!hasRequiredRole(tenant.roles, "SUPER_ADMIN")) {
    return fail("Only super admins can revoke company plans.", 403);
  }

  const json = (await request.json()) as Record<string, unknown>;
  const body = companySubscriptionRevocationSchema.safeParse(json);
  if (!body.success) {
    return fail("Invalid subscription update payload.", 400);
  }

  const { subscriptionId } = await params;

  try {
    const subscription = await revokeCompanySubscription(tenant, subscriptionId, body.data);
    return ok(subscription);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Unable to revoke company subscription.",
      400,
    );
  }
}
