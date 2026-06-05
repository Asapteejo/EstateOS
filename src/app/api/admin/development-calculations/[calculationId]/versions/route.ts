import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { developmentCalculationVersionSchema } from "@/lib/validations/development-calculations";
import { createDevelopmentCalculationVersion } from "@/modules/development-calculations/service";
import {
  adminMutationRateLimit,
  enforceRateLimit,
  getClientIp,
} from "@/lib/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ calculationId: string }> },
) {
  try {
    const tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });

    const rateLimited = await enforceRateLimit(
      adminMutationRateLimit,
      [`ip:${getClientIp(request)}`, `user:${tenant.userId ?? "admin"}`],
      "Too many requests. Please slow down and try again.",
    );
    if (rateLimited) return rateLimited;

    const { calculationId } = await params;
    const json = (await request.json()) as Record<string, unknown>;
    const body = developmentCalculationVersionSchema.safeParse(json);

    if (!body.success) {
      return fail("Invalid development calculation version payload.", 400);
    }

    const created = await createDevelopmentCalculationVersion(tenant, calculationId, {
      ...json,
      ...body.data,
    });

    return ok(created, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to save feasibility version.", 400);
  }
}
