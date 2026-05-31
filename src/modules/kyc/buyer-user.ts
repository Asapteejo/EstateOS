import { prisma } from "@/lib/db/prisma";
import type { TenantContext } from "@/lib/tenancy/context";

export const BUYER_PROFILE_NOT_INITIALIZED_MESSAGE =
  "Buyer profile is not initialized. Please reload dev buyer session.";

type BuyerUserCandidate = {
  id: string;
  email: string;
  companyId: string | null;
};

type UserLookupDelegate = {
  findFirst: (args: {
    where: Record<string, unknown>;
    select: { id: true; email: true; companyId: true };
  }) => Promise<BuyerUserCandidate | null>;
};

export function selectTenantBuyerUser(input: {
  companyId: string;
  byId?: BuyerUserCandidate | null;
  byClerkUserId?: BuyerUserCandidate | null;
  byEmail?: BuyerUserCandidate | null;
}) {
  const candidates = [input.byId, input.byClerkUserId, input.byEmail];
  return candidates.find((candidate) => candidate?.companyId === input.companyId) ?? null;
}

export function assertTenantBuyerUser(
  user: BuyerUserCandidate | null,
  companyId: string,
) {
  if (!user || user.companyId !== companyId) {
    throw new Error(BUYER_PROFILE_NOT_INITIALIZED_MESSAGE);
  }

  return user;
}

export async function resolveBuyerDbUserForKyc(
  context: Pick<TenantContext, "companyId" | "userId">,
  options?: {
    email?: string | null;
    userDelegate?: UserLookupDelegate;
  },
) {
  if (!context.companyId || !context.userId) {
    throw new Error("Authentication and tenant context are required.");
  }

  const userDelegate = options?.userDelegate ?? prisma.user;
  const [byId, byClerkUserId, byEmail] = await Promise.all([
    userDelegate.findFirst({
      where: {
        id: context.userId,
        companyId: context.companyId,
      },
      select: { id: true, email: true, companyId: true },
    }),
    userDelegate.findFirst({
      where: {
        clerkUserId: context.userId,
        companyId: context.companyId,
      },
      select: { id: true, email: true, companyId: true },
    }),
    options?.email
      ? userDelegate.findFirst({
          where: {
            email: options.email,
            companyId: context.companyId,
          },
          select: { id: true, email: true, companyId: true },
        })
      : Promise.resolve(null),
  ]);

  return assertTenantBuyerUser(
    selectTenantBuyerUser({
      companyId: context.companyId,
      byId,
      byClerkUserId,
      byEmail,
    }),
    context.companyId,
  );
}

export async function resolveBuyerTenantContextForKyc(
  context: TenantContext,
  options?: {
    email?: string | null;
    userDelegate?: UserLookupDelegate;
  },
): Promise<TenantContext> {
  const user = await resolveBuyerDbUserForKyc(context, options);
  return {
    ...context,
    userId: user.id,
  };
}
