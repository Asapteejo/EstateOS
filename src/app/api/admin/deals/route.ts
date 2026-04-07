import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { adminDealCreateSchema } from "@/lib/validations/deals";
import { createAdminDeal } from "@/modules/admin/deals";

export async function POST(request: Request) {
  try {
    const tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
    const json = (await request.json()) as Record<string, unknown>;
    const body = adminDealCreateSchema.safeParse(json);

    if (!body.success) {
      return fail("Invalid deal payload.", 400);
    }

    const created = await createAdminDeal(tenant, {
      ...json,
      ...body.data,
    });

    return ok(created, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to create deal.", 400);
  }
}
