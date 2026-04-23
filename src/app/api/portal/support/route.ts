import { requireBuyerPortalSession } from "@/lib/auth/guards";
import { getAppSession } from "@/lib/auth/session";
import { fail, ok } from "@/lib/http";
import { captureServerEvent, captureServerException } from "@/lib/integrations/posthog";
import { supportRateLimit } from "@/lib/rate-limit";
import { supportRequestSchema } from "@/lib/validations/support";
import { submitSupportRequest } from "@/modules/support/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let tenant: Awaited<ReturnType<typeof requireBuyerPortalSession>>;
  try {
    tenant = await requireBuyerPortalSession({ redirectOnMissingAuth: false });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Authentication and buyer context are required.",
      401,
    );
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || "local";
  const rateLimitKey = `${tenant.companyId ?? "unknown"}:${tenant.userId ?? ip}`;
  if (supportRateLimit) {
    const limitResult = await supportRateLimit.limit(rateLimitKey);
    if (!limitResult.success) {
      return fail("Too many support requests. Please wait a few minutes and try again.", 429);
    }
  }

  const json = (await request.json()) as Record<string, unknown>;
  const body = supportRequestSchema.safeParse(json);
  if (!body.success) {
    return fail("Invalid support request payload.", 400);
  }

  const session = await getAppSession("portal");

  try {
    const result = await submitSupportRequest(
      {
        tenant,
        reporterName:
          session ? `${session.firstName} ${session.lastName}`.trim() || null : null,
        reporterEmail: session?.email ?? null,
      },
      body.data,
    );

    await captureServerEvent(
      "support_request_submitted",
      {
        category: body.data.category,
        supportRequestId: result.id,
        syncStatus: result.syncStatus,
      },
      {
        source: "support",
        route: "/api/portal/support",
        method: "POST",
        companyId: tenant.companyId,
        companySlug: tenant.companySlug,
        userId: tenant.userId,
        area: "portal",
        requestId: request.headers.get("x-vercel-id"),
      },
      {
        severity: "LOW",
        supportRequestId: result.id,
      },
    );

    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit support request.";
    if (!message.includes("submitted recently")) {
      await captureServerException(error, {
        source: "support",
        route: "/api/portal/support",
        method: "POST",
        companyId: tenant.companyId,
        companySlug: tenant.companySlug,
        userId: tenant.userId,
        area: "portal",
        requestId: request.headers.get("x-vercel-id"),
        statusCode: 500,
      }, {
        severity: "MEDIUM",
      });
    }

    return fail(message, 400);
  }
}
