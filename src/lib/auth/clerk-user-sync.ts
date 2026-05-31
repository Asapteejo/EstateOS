import { prisma } from "@/lib/db/prisma";

type UserSyncRecord = {
  id: string;
  clerkUserId: string;
};

type UserSyncDelegate = {
  findFirst(args: {
    where: { email: { equals: string; mode: "insensitive" } };
    select: { id: true; clerkUserId: true };
  }): Promise<UserSyncRecord | null>;
  create(args: {
    data: {
      clerkUserId: string;
      email: string;
      firstName: string;
      lastName: string;
      phone: string | null;
    };
    select: { id: true; clerkUserId: true };
  }): Promise<UserSyncRecord>;
  update(args: {
    where: { id: string };
    data: {
      clerkUserId: string;
      email: string;
      firstName: string;
      lastName: string;
      phone: string | null;
    };
    select: { id: true; clerkUserId: true };
  }): Promise<UserSyncRecord>;
};

export type ClerkUserSyncInput = {
  clerkUserId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
};

export type ClerkUserSyncResult = {
  userId: string;
  outcome: "created" | "linked" | "updated";
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function canLinkPlaceholderClerkId(clerkUserId: string) {
  return clerkUserId.startsWith("manual:");
}

export async function syncAuthenticatedClerkUser(
  input: ClerkUserSyncInput,
  userDelegate = prisma.user as unknown as UserSyncDelegate,
): Promise<ClerkUserSyncResult> {
  const email = normalizeEmail(input.email);
  if (!email) {
    throw new Error("Authenticated Clerk user is missing an email address.");
  }

  const existing = await userDelegate.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, clerkUserId: true },
  });
  const data = {
    clerkUserId: input.clerkUserId,
    email,
    firstName: input.firstName?.trim() ?? "",
    lastName: input.lastName?.trim() ?? "",
    phone: input.phone?.trim() || null,
  };

  if (!existing) {
    const created = await userDelegate.create({
      data,
      select: { id: true, clerkUserId: true },
    });
    return { userId: created.id, outcome: "created" };
  }

  if (
    existing.clerkUserId !== input.clerkUserId &&
    !canLinkPlaceholderClerkId(existing.clerkUserId)
  ) {
    throw new Error("Email address is already linked to a different Clerk identity.");
  }

  const updated = await userDelegate.update({
    where: { id: existing.id },
    data,
    select: { id: true, clerkUserId: true },
  });
  return {
    userId: updated.id,
    outcome: existing.clerkUserId === input.clerkUserId ? "updated" : "linked",
  };
}

