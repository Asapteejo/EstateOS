import type { Document } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { logWarn } from "@/lib/ops/logger";
import type { TenantContext } from "@/lib/tenancy/context";
import { assertTenantAccess } from "@/lib/tenancy/context";
import { findFirstForTenant } from "@/lib/tenancy/db";

type DocumentForAccess = Pick<Document, "id" | "companyId" | "userId" | "storageKey" | "visibility" | "fileName" | "mimeType"> & {
  transaction: { userId: string } | null;
};
type ScopedFindFirstDelegate = { findFirst: (args?: unknown) => Promise<unknown> };
type UserLookupDelegate = {
  findFirst: (args: {
    where: Record<string, unknown>;
    select: { id: true; companyId: true };
  }) => Promise<{ id: string; companyId: string | null } | null>;
};

export type { DocumentForAccess };

export async function getDocumentForTenantAccess(
  documentId: string,
  context: TenantContext,
) {
  if (!featureFlags.hasDatabase) {
    return null;
  }

  return (await findFirstForTenant(prisma.document as ScopedFindFirstDelegate, context, {
    where: {
      id: documentId,
    },
    select: {
      id: true,
      companyId: true,
      userId: true,
      storageKey: true,
      visibility: true,
      fileName: true,
      mimeType: true,
      transaction: {
        select: {
          userId: true,
        },
      },
    },
  })) as DocumentForAccess | null;
}

export function assertDocumentAccess(
  context: TenantContext,
  document: DocumentForAccess | null,
) {
  if (!document) {
    throw new Error("Document not found.");
  }

  assertTenantAccess(context, document.companyId);

  if (context.isSuperAdmin) {
    return true;
  }

  const isBuyer = context.roles.includes("BUYER");
  if (!isBuyer) {
    return true;
  }

  const isOwnedByBuyer =
    document.userId === context.userId ||
    document.transaction?.userId === context.userId;

  if (!isOwnedByBuyer) {
    throw new Error("Document access denied.");
  }

  return true;
}

export async function resolveDocumentAccessLogUserId(
  context: TenantContext,
  options?: {
    email?: string | null;
    userDelegate?: UserLookupDelegate;
  },
) {
  if (!context.userId) {
    return null;
  }

  const userDelegate = options?.userDelegate ?? prisma.user;
  const user = await userDelegate.findFirst({
    where: {
      OR: [
        { id: context.userId },
        { clerkUserId: context.userId },
        ...(options?.email ? [{ email: options.email }] : []),
      ],
      ...(context.isSuperAdmin || !context.companyId ? {} : { companyId: context.companyId }),
    },
    select: {
      id: true,
      companyId: true,
    },
  });

  if (!user) {
    return null;
  }

  if (!context.isSuperAdmin && context.companyId && user.companyId !== context.companyId) {
    return null;
  }

  return user.id;
}

export async function writeDocumentAccessLog(input: {
  context: TenantContext;
  document: DocumentForAccess;
  action?: string;
  email?: string | null;
  userDelegate?: UserLookupDelegate;
}) {
  if (!featureFlags.hasDatabase) {
    return;
  }

  const userId = await resolveDocumentAccessLogUserId(input.context, {
    email: input.email,
    userDelegate: input.userDelegate,
  });

  if (!userId) {
    logWarn("Document access log user could not be resolved; writing anonymous access log.", {
      documentId: input.document.id,
      companyId: input.document.companyId,
      sessionUserId: input.context.userId,
      roles: input.context.roles,
    });
  }

  try {
    await prisma.documentAccessLog.create({
      data: {
        companyId: input.document.companyId,
        documentId: input.document.id,
        userId,
        action: input.action ?? "DOWNLOAD",
      },
    });
  } catch (error) {
    logWarn("Document access log write failed; continuing authorized document download.", {
      documentId: input.document.id,
      companyId: input.document.companyId,
      resolvedUserId: userId,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
