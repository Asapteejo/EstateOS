import type { Document } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import type { TenantContext } from "@/lib/tenancy/context";
import { assertTenantAccess } from "@/lib/tenancy/context";
import { findFirstForTenant } from "@/lib/tenancy/db";

type DocumentForAccess = Pick<Document, "id" | "companyId" | "userId" | "storageKey" | "visibility" | "fileName"> & {
  transaction: { userId: string } | null;
};
type ScopedFindFirstDelegate = { findFirst: (args?: unknown) => Promise<unknown> };

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
