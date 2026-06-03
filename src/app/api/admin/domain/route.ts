import { z } from "zod";

import { requireAdminSession } from "@/lib/auth/guards";
import { featureFlags } from "@/lib/env";
import { fail, ok } from "@/lib/http";
import { getCompanyDomainSetup, setCompanyCustomDomain } from "@/modules/domains/service";
export const runtime = "nodejs";

const schema = z.object({
  customDomain: z.string().trim().optional().nullable().or(z.literal("")),
});

// ─── PATCH — save custom domain ──────────────────────────────────────────────

export async function PATCH(request: Request) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication required.", 401);
  }

  if (!featureFlags.hasDatabase || !tenant.companyId) {
    return fail("Service unavailable.", 503);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail("Invalid request body.", 400);
  }

  const body = schema.safeParse(json);
  if (!body.success) {
    return fail(body.error.issues[0]?.message ?? "Invalid input.", 400);
  }

  let company: Awaited<ReturnType<typeof setCompanyCustomDomain>>;
  try {
    company = await setCompanyCustomDomain({
      companyId: tenant.companyId,
      customDomain: body.data.customDomain || null,
      actor: { userId: tenant.userId, source: "tenant_admin" },
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to save custom domain.", 400);
  }

  const setup = await getCompanyDomainSetup(tenant.companyId);
  return ok({ company, vercel: setup.vercel, dns: setup.dns });
}
