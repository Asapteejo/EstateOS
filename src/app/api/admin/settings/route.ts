import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/guards";
import { featureFlags } from "@/lib/env";
import { fail, ok } from "@/lib/http";
import { tenantSettingsSchema } from "@/lib/validations/settings";
import { getTenantAdminSettings, updateTenantAdminSettings } from "@/modules/settings/service";

export async function GET() {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  if (!featureFlags.isProduction) {
    console.info(
      JSON.stringify({
        level: "info",
        message: "Admin settings PATCH tenant resolved.",
        context: {
          companyId: tenant.companyId,
          companySlug: tenant.companySlug,
          userId: tenant.userId,
          resolutionSource: tenant.resolutionSource,
        },
        timestamp: new Date().toISOString(),
      }),
    );
  }

  try {
    const settings = await getTenantAdminSettings(tenant);
    return ok(settings);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load settings.", 400);
  }
}

export async function PATCH(request: Request) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  const json = (await request.json()) as Record<string, unknown>;
  const body = tenantSettingsSchema.safeParse(json);
  if (!body.success) {
    if (!featureFlags.isProduction) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid tenant settings payload.",
          issues: body.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    return fail("Invalid tenant settings payload.");
  }

  try {
    const settings = await updateTenantAdminSettings(tenant, {
      ...json,
      ...body.data,
    });
    return ok(settings);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update settings.", 400);
  }
}
