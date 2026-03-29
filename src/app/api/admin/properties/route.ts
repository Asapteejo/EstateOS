import { requireAdminSession } from "@/lib/auth/guards";
import { ok, fail } from "@/lib/http";
import { rejectUnsafeCompanyIdInput } from "@/lib/tenancy/db";
import { slugify } from "@/lib/utils";
import { propertyCreateSchema } from "@/lib/validations/properties";

export async function GET() {
  try {
    await requireAdminSession(undefined, { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }
  return ok({
    message: "Admin property CRUD foundation is ready for Prisma-backed persistence.",
  });
}

export async function POST(request: Request) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(undefined, { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }
  const json = (await request.json()) as Record<string, unknown>;

  try {
    rejectUnsafeCompanyIdInput(json);
  } catch {
    return fail("Caller-provided companyId is not allowed.", 400);
  }

  const body = propertyCreateSchema.safeParse(json);
  if (!body.success) {
    return fail("Invalid property payload.");
  }

  return ok(
    {
      ...body.data,
      companyId: tenant.companyId,
      slug: slugify(body.data.title),
      status: body.data.status,
    },
    { status: 201 },
  );
}
