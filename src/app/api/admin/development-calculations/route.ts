import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { developmentCalculationSchema } from "@/lib/validations/development-calculations";
import {
  createDevelopmentCalculation,
  getDevelopmentCalculationWorkspace,
} from "@/modules/development-calculations/service";
import {
  adminMutationRateLimit,
  enforceRateLimit,
  getClientIp,
} from "@/lib/rate-limit";

export async function GET() {
  try {
    const tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
    const workspace = await getDevelopmentCalculationWorkspace(tenant);
    return ok({
      calculations: workspace.calculations,
      defaultCurrency: workspace.defaultCurrency,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load feasibility projects.", 400);
  }
}

export async function POST(request: Request) {
  try {
    const tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });

    const rateLimited = await enforceRateLimit(
      adminMutationRateLimit,
      [`ip:${getClientIp(request)}`, `user:${tenant.userId ?? "admin"}`],
      "Too many requests. Please slow down and try again.",
    );
    if (rateLimited) return rateLimited;

    const json = (await request.json()) as Record<string, unknown>;
    const body = developmentCalculationSchema.safeParse(json);

    if (!body.success) {
      return fail("Invalid development calculation payload.", 400);
    }

    const created = await createDevelopmentCalculation(tenant, {
      ...json,
      ...body.data,
    });

    return ok(created, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to save feasibility project.", 400);
  }
}
