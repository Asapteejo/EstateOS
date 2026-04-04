import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { brandingActionSchema, brandingConfigSchema } from "@/lib/validations/branding";
import {
  getTenantBrandingState,
  publishDraftBrandingForAdmin,
  resetDraftBrandingForAdmin,
  saveDraftBrandingForAdmin,
} from "@/modules/branding/service";
import { getBrandingPublishIssues } from "@/modules/branding/theme";

export async function GET() {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  try {
    const state = await getTenantBrandingState(tenant);
    return ok({
      ...state,
      publishIssues: getBrandingPublishIssues(state.draft),
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load branding.", 400);
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
  const body = brandingConfigSchema.safeParse(json);
  if (!body.success) {
    return fail("Invalid branding payload.");
  }

  try {
    const state = await saveDraftBrandingForAdmin(tenant, body.data);
    return ok({
      ...state,
      publishIssues: getBrandingPublishIssues(state.draft),
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to save branding draft.", 400);
  }
}

export async function POST(request: Request) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  const json = (await request.json()) as Record<string, unknown>;
  const body = brandingActionSchema.safeParse(json);
  if (!body.success) {
    return fail("Invalid branding action.");
  }

  try {
    const state =
      body.data.action === "publish"
        ? await publishDraftBrandingForAdmin(tenant)
        : await resetDraftBrandingForAdmin(tenant);

    return ok({
      ...state,
      publishIssues: getBrandingPublishIssues(state.draft),
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update branding.", 400);
  }
}
