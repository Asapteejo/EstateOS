import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { adminQuickPropertyCreateSchema } from "@/lib/validations/deals";
import { quickCreatePropertyForDeal } from "@/modules/admin/deals";

export async function POST(request: Request) {
  try {
    const tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
    const json = (await request.json()) as Record<string, unknown>;
    const body = adminQuickPropertyCreateSchema.safeParse(json);

    if (!body.success) {
      return fail("Invalid property payload.", 400);
    }

    const created = await quickCreatePropertyForDeal(tenant, {
      ...json,
      ...body.data,
    });

    return ok(created, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to quick add property.", 400);
  }
}
