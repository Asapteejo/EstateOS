import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { captureServerEvent, captureServerException } from "@/lib/integrations/posthog";
import { supportRetrySchema } from "@/lib/validations/support";
import { retrySupportRequestSync } from "@/modules/support/service";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication and tenant context are required.", 401);
  }

  const rawParams = await params;
  const parsed = supportRetrySchema.safeParse({ requestId: rawParams.requestId });
  if (!parsed.success) {
    return fail("Invalid support retry request.", 400);
  }

  try {
    const result = await retrySupportRequestSync({
      tenant,
      requestId: parsed.data.requestId,
    });

    await captureServerEvent(
      "support_request_retry_triggered",
      {
        supportRequestId: parsed.data.requestId,
        syncStatus: result.syncStatus,
        alreadyLinked: result.alreadyLinked,
      },
      {
        source: "support",
        route: "/api/admin/support/[requestId]/retry",
        method: "POST",
        companyId: tenant.companyId,
        companySlug: tenant.companySlug,
        userId: tenant.userId,
        area: "admin",
      },
      {
        severity:
          result.syncStatus === "FAILED" || result.syncStatus === "MAX_RETRIES_EXCEEDED"
            ? "MEDIUM"
            : "LOW",
        supportRequestId: parsed.data.requestId,
      },
    );

    return ok(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to retry support request sync.";
    if (
      !message.includes("retry cap") &&
      !message.includes("Only failed or skipped") &&
      !message.includes("not configured") &&
      !message.includes("already linked")
    ) {
      await captureServerException(error, {
        source: "support",
        route: "/api/admin/support/[requestId]/retry",
        method: "POST",
        companyId: tenant.companyId,
        companySlug: tenant.companySlug,
        userId: tenant.userId,
        area: "admin",
        statusCode: 500,
      }, {
        severity: "MEDIUM",
        supportRequestId: parsed.data.requestId,
      });
    }

    return fail(
      message,
      400,
    );
  }
}
