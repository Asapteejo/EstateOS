import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { developmentCalculationSchema } from "@/lib/validations/development-calculations";
import {
  archiveDevelopmentCalculation,
  getDevelopmentCalculationDetail,
  updateDevelopmentCalculation,
} from "@/modules/development-calculations/service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ calculationId: string }> },
) {
  try {
    const tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
    const { calculationId } = await params;
    const calculation = await getDevelopmentCalculationDetail(tenant, calculationId);

    if (!calculation) {
      return fail("Feasibility project not found.", 404);
    }

    return ok(calculation);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load feasibility project.", 400);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ calculationId: string }> },
) {
  try {
    const tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
    const { calculationId } = await params;
    const json = (await request.json()) as Record<string, unknown>;
    const body = developmentCalculationSchema.safeParse(json);

    if (!body.success) {
      return fail("Invalid development calculation payload.", 400);
    }

    const updated = await updateDevelopmentCalculation(tenant, calculationId, {
      ...json,
      ...body.data,
    });

    return ok(updated);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update feasibility project.", 400);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ calculationId: string }> },
) {
  try {
    const tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
    const { calculationId } = await params;
    const archived = await archiveDevelopmentCalculation(tenant, calculationId);
    return ok(archived);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to archive feasibility project.", 400);
  }
}
