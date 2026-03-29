import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { teamMemberMutationSchema } from "@/lib/validations/team";
import { updateTeamMemberForAdmin } from "@/modules/team/mutations";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ teamMemberId: string }> },
) {
  const tenant = await requireAdminSession();
  const { teamMemberId } = await params;
  const json = (await request.json()) as Record<string, unknown>;
  const body = teamMemberMutationSchema.safeParse(json);

  if (!body.success) {
    return fail("Invalid marketer profile payload.");
  }

  try {
    const result = await updateTeamMemberForAdmin(tenant, teamMemberId, body.data);
    return ok(result);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update marketer profile.", 400);
  }
}
