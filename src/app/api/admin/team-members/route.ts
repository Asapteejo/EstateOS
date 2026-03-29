import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { teamMemberMutationSchema } from "@/lib/validations/team";
import { createTeamMemberForAdmin } from "@/modules/team/mutations";

export async function POST(request: Request) {
  const tenant = await requireAdminSession();
  const json = (await request.json()) as Record<string, unknown>;
  const body = teamMemberMutationSchema.safeParse(json);

  if (!body.success) {
    return fail("Invalid marketer profile payload.");
  }

  try {
    const result = await createTeamMemberForAdmin(tenant, body.data);
    return ok(result, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to create marketer profile.", 400);
  }
}
