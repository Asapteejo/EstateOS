import { hasRequiredRole } from "@/lib/auth/roles";
import { fail, ok } from "@/lib/http";
import { requireTenantContext } from "@/lib/tenancy/context";
import { billingPlanUpsertSchema } from "@/lib/validations/billing";
import { updatePlan } from "@/modules/billing/mutations";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  let tenant: Awaited<ReturnType<typeof requireTenantContext>>;
  try {
    tenant = await requireTenantContext("admin", { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and superadmin access are required.", 401);
  }

  if (!hasRequiredRole(tenant.roles, "SUPER_ADMIN")) {
    return fail("Only super admins can update billing plans.", 403);
  }

  const json = (await request.json()) as Record<string, unknown>;
  const body = billingPlanUpsertSchema.safeParse(json);
  if (!body.success) {
    return fail("Invalid plan payload.", 400);
  }

  const { planId } = await params;

  try {
    const plan = await updatePlan(tenant, planId, body.data);
    return ok(plan);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update plan.", 400);
  }
}
