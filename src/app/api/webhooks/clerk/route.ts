import { Webhook } from "svix";

import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/db/prisma";
import { env, featureFlags } from "@/lib/env";
import { logError, logWarn } from "@/lib/ops/logger";
import { captureException } from "@/lib/sentry";

export async function POST(request: Request) {
  if (!featureFlags.hasDatabase || !env.CLERK_WEBHOOK_SECRET) {
    return ok({ skipped: true });
  }

  const payload = await request.text();
  const headers = request.headers;

  const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);

  let event: {
    type: string;
    data: {
      id: string;
      email_addresses?: { email_address: string }[];
      first_name?: string | null;
      last_name?: string | null;
      phone_numbers?: { phone_number: string }[];
      public_metadata?: {
        companyId?: string;
        branchId?: string;
      };
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
    const primaryEmail = event.data.email_addresses?.[0]?.email_address;

    if (!primaryEmail) {
      return fail("Missing primary email.");
    }

    const companyId =
      event.data.public_metadata?.companyId &&
      (await prisma.company.findUnique({
        where: {
          id: event.data.public_metadata.companyId,
        },
        select: {
          id: true,
        },
      }))?.id;

    const branchId =
      event.data.public_metadata?.branchId && companyId
        ? (await prisma.branch.findFirst({
            where: {
              id: event.data.public_metadata.branchId,
              companyId,
            },
            select: {
              id: true,
            },
          }))?.id
        : null;

    try {
      await prisma.user.upsert({
        where: { clerkUserId: event.data.id },
        create: {
          clerkUserId: event.data.id,
          email: primaryEmail,
          firstName: event.data.first_name ?? "",
          lastName: event.data.last_name ?? "",
          phone: event.data.phone_numbers?.[0]?.phone_number,
          companyId: companyId ?? null,
          branchId,
        },
        update: {
          email: primaryEmail,
          firstName: event.data.first_name ?? "",
          lastName: event.data.last_name ?? "",
          phone: event.data.phone_numbers?.[0]?.phone_number,
          companyId: companyId ?? null,
          branchId,
        },
      });
    } catch (error) {
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
