import { Webhook } from "svix";

import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/db/prisma";
import { env, featureFlags } from "@/lib/env";

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
    return fail("Invalid Clerk webhook signature.", 401);
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    const primaryEmail = event.data.email_addresses?.[0]?.email_address;

    if (!primaryEmail) {
      return fail("Missing primary email.");
    }

    await prisma.user.upsert({
      where: { clerkUserId: event.data.id },
      create: {
        clerkUserId: event.data.id,
        email: primaryEmail,
        firstName: event.data.first_name ?? "",
        lastName: event.data.last_name ?? "",
        phone: event.data.phone_numbers?.[0]?.phone_number,
        companyId: event.data.public_metadata?.companyId,
        branchId: event.data.public_metadata?.branchId,
      },
      update: {
        email: primaryEmail,
        firstName: event.data.first_name ?? "",
        lastName: event.data.last_name ?? "",
        phone: event.data.phone_numbers?.[0]?.phone_number,
        companyId: event.data.public_metadata?.companyId,
        branchId: event.data.public_metadata?.branchId,
      },
    });
  }

  return ok({ received: true });
}
