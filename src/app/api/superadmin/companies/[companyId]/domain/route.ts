import { z } from "zod";

import { isSuperadminAccessError, requireSuperAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import {
  getCompanyDomainSetup,
  markCompanyCustomDomainSkipped,
  removeCompanyCustomDomain,
  setCompanyCustomDomain,
  verifyCompanyCustomDomain,
} from "@/modules/domains/service";

export const runtime = "nodejs";

const patchSchema = z.object({
  action: z.enum(["set", "skip", "remove"]),
  customDomain: z.string().trim().optional().nullable(),
  confirmation: z.string().trim().optional().nullable(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  try {
    await requireSuperAdminSession({ redirectOnMissingAuth: false });
    const { companyId } = await params;
    return ok(await getCompanyDomainSetup(companyId));
  } catch (error) {
    if (isSuperadminAccessError(error)) return fail(error.message, 403);
    return fail(error instanceof Error ? error.message : "Unable to load custom domain setup.", 400);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  try {
    const context = await requireSuperAdminSession({ redirectOnMissingAuth: false });
    const { companyId } = await params;
    const json = (await request.json()) as Record<string, unknown>;
    const body = patchSchema.safeParse(json);
    if (!body.success) return fail("Invalid custom domain payload.", 400);

    if (body.data.action === "skip") {
      return ok({
        company: await markCompanyCustomDomainSkipped({
          companyId,
          actor: { userId: context.userId, source: "superadmin" },
        }),
      });
    }

    if (body.data.action === "remove") {
      return ok({
        company: await removeCompanyCustomDomain({
          companyId,
          confirmation: body.data.confirmation ?? null,
          actor: { userId: context.userId, source: "superadmin" },
        }),
      });
    }

    return ok({
      company: await setCompanyCustomDomain({
        companyId,
        customDomain: body.data.customDomain ?? null,
        actor: { userId: context.userId, source: "superadmin" },
      }),
    });
  } catch (error) {
    if (isSuperadminAccessError(error)) return fail(error.message, 403);
    return fail(error instanceof Error ? error.message : "Unable to update custom domain.", 400);
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  try {
    const context = await requireSuperAdminSession({ redirectOnMissingAuth: false });
    const { companyId } = await params;
    return ok(await verifyCompanyCustomDomain({
      companyId,
      actor: { userId: context.userId, source: "superadmin" },
    }));
  } catch (error) {
    if (isSuperadminAccessError(error)) return fail(error.message, 403);
    return fail(error instanceof Error ? error.message : "Unable to verify custom domain.", 400);
  }
}
