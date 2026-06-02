import { Webhook } from "svix";

import { ok, fail } from "@/lib/http";
import { selectClerkIdentitySyncInput, syncAuthenticatedClerkUser } from "@/lib/auth/clerk-user-sync";
import { env, featureFlags } from "@/lib/env";
import { captureServerException } from "@/lib/integrations/posthog";
import { logError, logWarn } from "@/lib/ops/logger";
import { captureException } from "@/lib/sentry";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!env.CLERK_WEBHOOK_SECRET) {
    logWarn("Rejected Clerk webhook because its signing secret is not configured.");
    return fail("Clerk webhook is not configured.", 503);
  }

  if (!featureFlags.hasDatabase) {
    logWarn("Rejected Clerk webhook because database access is not configured.");
    return fail("Clerk webhook is temporarily unavailable.", 503);
  }

  const payload = await request.text();
  const headers = request.headers;

  let wh: Webhook;
  try {
    wh = new Webhook(env.CLERK_WEBHOOK_SECRET);
  } catch {
    logWarn("Rejected Clerk webhook because its signing secret is invalid.");
    return fail("Clerk webhook is not configured.", 503);
  }

  let event: {
    type: string;
    data: {
      id: string;
      email_addresses?: { email_address: string }[];
      first_name?: string | null;
      last_name?: string | null;
      phone_numbers?: { phone_number: string }[];
    };
  };

  try {
    event = wh.verify(payload, {
      "svix-id": headers.get("svix-id") ?? "",
      "svix-timestamp": headers.get("svix-timestamp") ?? "",
      "svix-signature": headers.get("svix-signature") ?? "",
    }) as typeof event;
  } catch {
    logWarn("Rejected Clerk webhook with invalid signature.");
    return fail("Invalid Clerk webhook signature.", 401);
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    try {
      await syncAuthenticatedClerkUser(selectClerkIdentitySyncInput({
        id: event.data.id,
        emailAddresses: event.data.email_addresses?.map((address) => ({
          emailAddress: address.email_address,
        })),
        firstName: event.data.first_name,
        lastName: event.data.last_name,
        phoneNumbers: event.data.phone_numbers?.map((phone) => ({
          phoneNumber: phone.phone_number,
        })),
      }));
    } catch (error) {
      await captureServerException(error, {
        source: "webhook",
        route: "/api/webhooks/clerk",
        method: "POST",
        area: "api",
        requestId: request.headers.get("x-vercel-id"),
        statusCode: 500,
      }, {
        severity: "HIGH",
      });
      captureException(error);
      logError("Failed to persist Clerk webhook user sync.", {
        clerkUserId: event.data.id,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      return fail("Unable to sync Clerk user.", 400);
    }
  }

  return ok({ received: true });
}
