import { revalidateTag } from "next/cache";

import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok, validationFail } from "@/lib/http";
import {
  adminMutationRateLimit,
  enforceRateLimit,
  getClientIp,
} from "@/lib/rate-limit";
import { siteContentActionSchema, siteContentSchema } from "@/lib/validations/site-content";
import {
  getTenantSiteContentState,
  publishDraftSiteContentForAdmin,
  resetDraftSiteContentForAdmin,
  saveDraftSiteContentForAdmin,
} from "@/modules/cms/site-content-service";

export async function GET() {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  try {
    const state = await getTenantSiteContentState(tenant);
    return ok(state);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load site content.", 400);
  }
}

export async function PATCH(request: Request) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  const rateLimited = await enforceRateLimit(
    adminMutationRateLimit,
    [`ip:${getClientIp(request)}`, `user:${tenant.userId ?? "admin"}`],
    "Too many requests. Please slow down and try again.",
  );
  if (rateLimited) return rateLimited;

  const json = (await request.json()) as Record<string, unknown>;
  const body = siteContentSchema.safeParse(json);
  if (!body.success) {
    return validationFail(body.error);
  }

  try {
    const state = await saveDraftSiteContentForAdmin(tenant, body.data);
    return ok(state);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to save site content draft.", 400);
  }
}

export async function POST(request: Request) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  const rateLimited = await enforceRateLimit(
    adminMutationRateLimit,
    [`ip:${getClientIp(request)}`, `user:${tenant.userId ?? "admin"}`],
    "Too many requests. Please slow down and try again.",
  );
  if (rateLimited) return rateLimited;

  const json = (await request.json()) as Record<string, unknown>;
  const body = siteContentActionSchema.safeParse(json);
  if (!body.success) {
    return fail("Invalid site content action.");
  }

  try {
    const state =
      body.data.action === "publish"
        ? await publishDraftSiteContentForAdmin(tenant).then((publishedState) => {
            if (tenant.companyId) {
              revalidateTag(`tenant-presentation:${tenant.companyId}`, "max");
            }
            return publishedState;
          })
        : await resetDraftSiteContentForAdmin(tenant);

    return ok(state);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update site content.", 400);
  }
}
