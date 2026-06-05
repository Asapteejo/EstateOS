import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { teamMemberMutationSchema } from "@/lib/validations/team";
import { createTeamMemberForAdmin } from "@/modules/team/mutations";
import {
  adminMutationRateLimit,
  enforceRateLimit,
  getClientIp,
} from "@/lib/rate-limit";

export async function POST(request: Request) {
  const tenant = await requireAdminSession(["ADMIN"]);

  const rateLimited = await enforceRateLimit(
    adminMutationRateLimit,
    [`ip:${getClientIp(request)}`, `user:${tenant.userId ?? "admin"}`],
    "Too many requests. Please slow down and try again.",
  );
  if (rateLimited) return rateLimited;

  const json = (await request.json()) as Record<string, unknown>;
  const body = teamMemberMutationSchema.safeParse(json);

  if (!body.success) {
    return fail("Invalid staff profile payload.");
  }

  try {
    const result = await createTeamMemberForAdmin(tenant, body.data);
    return ok(result, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to create staff profile.", 400);
  }
}
