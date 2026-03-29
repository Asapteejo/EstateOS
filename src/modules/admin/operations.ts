import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import type { TenantContext } from "@/lib/tenancy/context";
import { findManyForTenant } from "@/lib/tenancy/db";

type ScopedFindManyDelegate = { findMany: (args?: unknown) => Promise<unknown> };
type Decimalish = { toNumber?: () => number } | number;

function decimalToNumber(value: Decimalish | null | undefined) {
  if (value == null) {
    return null;
  }

  return typeof value === "number" ? value : value.toNumber?.() ?? Number(value);
}

export async function getAdminTransactionManagementList(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return [];
  }

  return (await findManyForTenant(
    prisma.transaction as ScopedFindManyDelegate,
    context,
    {
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        currentStage: true,
        outstandingBalance: true,
        userId: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            companyId: true,
          },
        },
        property: {
          select: {
            title: true,
            companyId: true,
          },
        },
        reservation: {
          select: {
            id: true,
            reference: true,
            status: true,
          },
        },
      },
    } as Parameters<typeof prisma.transaction.findMany>[0],
  )) as Array<{
    id: string;
    currentStage: string;
    outstandingBalance: Decimalish;
    userId: string;
    user: {
      firstName: string | null;
      lastName: string | null;
      companyId: string | null;
    } | null;
    property: {
      title: string;
      companyId: string;
    } | null;
    reservation: {
      id: string;
      reference: string;
      status: string;
    } | null;
  }>;
}

export async function getAdminKycDocumentReviewList(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return [];
  }

  return (await findManyForTenant(
    prisma.kYCSubmission as ScopedFindManyDelegate,
    context,
    {
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        status: true,
        notes: true,
        updatedAt: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            companyId: true,
          },
        },
        document: {
          select: {
            id: true,
            fileName: true,
            documentType: true,
            companyId: true,
          },
        },
      },
    } as Parameters<typeof prisma.kYCSubmission.findMany>[0],
  )) as Array<{
    id: string;
    status: string;
    notes: string | null;
    updatedAt: Date;
    user: {
      firstName: string | null;
      lastName: string | null;
      companyId: string | null;
    };
    document: {
      id: string;
      fileName: string;
      documentType: string;
      companyId: string;
    };
  }>;
}

export function mapAdminTransactionsForTable(
  rows: Awaited<ReturnType<typeof getAdminTransactionManagementList>>,
) {
  return rows.map((transaction) => ({
    id: transaction.id,
    reservationId: transaction.reservation?.id ?? "",
    reference: transaction.reservation?.reference ?? transaction.id,
    reservationStatus: transaction.reservation?.status ?? "PENDING",
    property: transaction.property?.title ?? "Unlinked",
    buyer:
      transaction.user && transaction.user.companyId
        ? `${transaction.user.firstName ?? ""} ${transaction.user.lastName ?? ""}`.trim() ||
          "Unknown"
        : "Unknown",
    stage: transaction.currentStage,
    balance: decimalToNumber(transaction.outstandingBalance) ?? 0,
  }));
}
