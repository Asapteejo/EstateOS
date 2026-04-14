import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { developmentCalculationVersionSchema } from "@/lib/validations/development-calculations";
import { createDevelopmentCalculationVersion } from "@/modules/development-calculations/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ calculationId: string }> },
) {
  try {
    const tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
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
