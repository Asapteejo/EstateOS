/**
 * Contract acceptance service.
 *
 * Lifecycle for a signed agreement:
 *   PENDING   → admin uploaded a contract PDF and linked it to a transaction
 *   ACTIVE    → admin marked it as "sent" — buyer can now view and accept
 *   COMPLETED → buyer accepted in the portal (timestamp + IP recorded)
 *
 * All SignedAgreement queries use `as any` casts because the new schema
 * fields (sentAt, acceptedAt, acceptedByIp, acceptedByUserAgent) and the
 * new relations (transaction, document) won't appear in the generated
 * Prisma types until `prisma generate` is run after the migration.
 */

import { Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import {
  createInAppNotification,
  getTenantOperatorRecipients,
  notifyManyUsers,
} from "@/lib/notifications/service";
import { getPrivateDownloadUrl } from "@/lib/storage/r2";
import { PRODUCT_EVENT_NAMES, trackProductEvent } from "@/modules/analytics/activity";

// ─── Shared row type (mirrors the new schema fields) ────────────────────────

export type SignedAgreementRow = {
  id: string;
  companyId: string;
  transactionId: string;
  documentId: string;
  status: "PENDING" | "ACTIVE" | "COMPLETED" | "BLOCKED";
  sentAt: Date | null;
  acceptedAt: Date | null;
  acceptedByIp: string | null;
  acceptedByUserAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
  transaction: {
    id: string;
    currentStage: string;
    reservation: { reference: string } | null;
    user: { id: string; firstName: string | null; lastName: string | null; email: string | null };
    property: { title: string };
  };
  document: {
    id: string;
    fileName: string;
    storageKey: string;
    mimeType: string | null;
  };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const agreementSelect = {
  id: true,
  companyId: true,
  transactionId: true,
  documentId: true,
  status: true,
  sentAt: true,
  acceptedAt: true,
  acceptedByIp: true,
  acceptedByUserAgent: true,
  createdAt: true,
  updatedAt: true,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const saCreate = prisma.signedAgreement.create as (args: any) => Promise<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const saUpdate = prisma.signedAgreement.update as (args: any) => Promise<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const saFindMany = prisma.signedAgreement.findMany as (args: any) => Promise<any[]>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const saFindFirst = prisma.signedAgreement.findFirst as (args: any) => Promise<any | null>;

type SignedAgreementBaseRow = Awaited<ReturnType<typeof saFindFirst>>;

const transactionSelect = {
  id: true,
  currentStage: true,
  reservation: { select: { reference: true } },
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
  property: { select: { title: true } },
} satisfies Prisma.TransactionSelect;

const documentSelect = {
  id: true,
  fileName: true,
  storageKey: true,
  mimeType: true,
} satisfies Prisma.DocumentSelect;

async function hydrateAgreementRows(
  companyId: string,
  rows: NonNullable<SignedAgreementBaseRow>[],
): Promise<SignedAgreementRow[]> {
  if (rows.length === 0) return [];

  const transactionIds = [...new Set(rows.map((row) => row.transactionId))];
  const documentIds = [...new Set(rows.map((row) => row.documentId))];

  const [transactions, documents] = await Promise.all([
    prisma.transaction.findMany({
      where: { companyId, id: { in: transactionIds } },
      select: transactionSelect,
    }),
    prisma.document.findMany({
      where: { companyId, id: { in: documentIds } },
      select: documentSelect,
    }),
  ]);

  const transactionMap = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const documentMap = new Map(documents.map((document) => [document.id, document]));

  return rows
    .map((row) => {
      const transaction = transactionMap.get(row.transactionId);
      const document = documentMap.get(row.documentId);

      if (!transaction || !document) return null;

      return {
        ...row,
        transaction,
        document,
      };
    })
    .filter((row): row is SignedAgreementRow => row !== null);
}

async function hydrateAgreementRow(
  companyId: string,
  row: NonNullable<SignedAgreementBaseRow> | null,
): Promise<SignedAgreementRow | null> {
  if (!row) return null;

  const [hydrated] = await hydrateAgreementRows(companyId, [row]);
  return hydrated ?? null;
}

// ─── Admin: create contract record ──────────────────────────────────────────

/**
 * Links an uploaded contract document to a transaction, creating a
 * SignedAgreement in PENDING status. The buyer cannot see it until
 * `sendContract` is called.
 *
 * Throws if a contract is already linked to the transaction.
 */
export async function createContract(input: {
  companyId: string;
  transactionId: string;
  documentId: string;
  actorUserId?: string;
}): Promise<SignedAgreementRow> {
  const created = await saCreate({
    data: {
      companyId: input.companyId,
      transactionId: input.transactionId,
      documentId: input.documentId,
      status: "PENDING",
    },
    select: agreementSelect,
  });
  const row = await hydrateAgreementRow(input.companyId, created);
  if (!row) throw new Error("Created contract could not be loaded.");

  await writeAuditLog({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    action: "CREATE",
    entityType: "SignedAgreement",
    entityId: row.id,
    summary: `Contract uploaded for ${row.transaction.reservation?.reference ?? row.transactionId}`,
    payload: { transactionId: input.transactionId, documentId: input.documentId } as Prisma.InputJsonValue,
  });

  return row;
}

// ─── Admin: send contract to buyer ──────────────────────────────────────────

/**
 * Marks the agreement as ACTIVE (sent) and notifies the buyer via in-app
 * notification. Idempotent — calling it on an already-ACTIVE agreement
 * returns the existing row without re-notifying.
 */
export async function sendContract(input: {
  signedAgreementId: string;
  companyId: string;
  actorUserId?: string;
}): Promise<SignedAgreementRow> {
  const existing = await hydrateAgreementRow(
    input.companyId,
    await saFindFirst({
      where: { id: input.signedAgreementId, companyId: input.companyId },
      select: agreementSelect,
    }),
  );

  if (!existing) throw new Error("Contract not found.");
  if (existing.status === "COMPLETED") throw new Error("Contract already accepted by buyer.");

  // Idempotent: don't re-notify if already sent
  if (existing.status === "ACTIVE") return existing;

  const updated = await hydrateAgreementRow(
    input.companyId,
    await saUpdate({
      where: { id: input.signedAgreementId },
      data: { status: "ACTIVE", sentAt: new Date() },
      select: agreementSelect,
    }),
  );
  if (!updated) throw new Error("Sent contract could not be loaded.");

  // Notify buyer
  const buyerUserId = updated.transaction.user.id;
  const reservationRef = updated.transaction.reservation?.reference ?? "your reservation";
  await createInAppNotification({
    companyId: input.companyId,
    userId: buyerUserId,
    type: "DOCUMENT_REQUESTED",
    title: "Your contract is ready to review",
    body: `The agreement for ${reservationRef} is available in your portal. Please review and accept it to proceed.`,
    metadata: {
      signedAgreementId: input.signedAgreementId,
      href: "/portal/contracts",
    } as Prisma.InputJsonValue,
  });

  await writeAuditLog({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    action: "UPDATE",
    entityType: "SignedAgreement",
    entityId: input.signedAgreementId,
    summary: `Contract sent to buyer for ${reservationRef}`,
    payload: { transactionId: updated.transactionId } as Prisma.InputJsonValue,
  });

  return updated;
}

// ─── Buyer: accept contract ──────────────────────────────────────────────────

/**
 * Records buyer acceptance. Verifies that the agreement belongs to the
 * authenticated buyer before writing. Stamps acceptedAt, IP, and UA.
 */
export async function acceptContract(input: {
  signedAgreementId: string;
  userId: string;
  companyId: string;
  ipAddress: string;
  userAgent: string;
}): Promise<SignedAgreementRow> {
  // Verify the buyer owns this agreement
  const existing = await hydrateAgreementRow(
    input.companyId,
    await saFindFirst({
      where: {
        id: input.signedAgreementId,
        companyId: input.companyId,
      },
      select: agreementSelect,
    }),
  );

  if (!existing || existing.transaction.user.id !== input.userId) {
    throw new Error("Contract not found or access denied.");
  }
  if (existing.status !== "ACTIVE") {
    throw new Error("Contract is not available for acceptance.");
  }

  const now = new Date();

  const updated = await hydrateAgreementRow(
    input.companyId,
    await saUpdate({
      where: { id: input.signedAgreementId },
      data: {
        status: "COMPLETED",
        acceptedAt: now,
        acceptedByIp: input.ipAddress,
        acceptedByUserAgent: input.userAgent,
      },
      select: agreementSelect,
    }),
  );
  if (!updated) throw new Error("Accepted contract could not be loaded.");

  const reservationRef = updated.transaction.reservation?.reference ?? updated.transactionId;

  // Notify operators
  const operators = await getTenantOperatorRecipients(input.companyId);
  await notifyManyUsers(operators, {
    companyId: input.companyId,
    type: "MILESTONE_UPDATED",
    title: "Contract accepted",
    body: `${updated.transaction.user.firstName ?? "Buyer"} accepted the agreement for ${reservationRef}.`,
    metadata: {
      signedAgreementId: input.signedAgreementId,
      href: "/admin/contracts",
    } as Prisma.InputJsonValue,
  });

  await writeAuditLog({
    companyId: input.companyId,
    actorUserId: input.userId,
    action: "UPDATE",
    entityType: "SignedAgreement",
    entityId: input.signedAgreementId,
    summary: `Buyer accepted contract for ${reservationRef}`,
    payload: {
      acceptedAt: now.toISOString(),
      ipAddress: input.ipAddress,
    } as Prisma.InputJsonValue,
  });

  await trackProductEvent({
    companyId: input.companyId,
    userId: input.userId,
    eventName: PRODUCT_EVENT_NAMES.contractAccepted,
    summary: `Contract accepted for ${reservationRef}`,
    payload: { signedAgreementId: input.signedAgreementId } as Prisma.InputJsonValue,
  });

  return updated;
}

// ─── Admin: list all contracts for a company ─────────────────────────────────

export async function getAdminContractRows(companyId: string): Promise<SignedAgreementRow[]> {
  return hydrateAgreementRows(
    companyId,
    await saFindMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      select: agreementSelect,
    }),
  );
}

// ─── Admin: get one contract for a transaction ───────────────────────────────

export async function getContractForTransaction(
  transactionId: string,
  companyId: string,
): Promise<SignedAgreementRow | null> {
  return hydrateAgreementRow(
    companyId,
    await saFindFirst({
      where: { transactionId, companyId },
      select: agreementSelect,
    }),
  );
}

// ─── Portal: list contracts visible to a buyer ───────────────────────────────

export type BuyerContractRow = SignedAgreementRow & { downloadUrl: string };

export async function getBuyerContracts(
  userId: string,
  companyId: string,
): Promise<BuyerContractRow[]> {
  const buyerTransactionIds = (
    await prisma.transaction.findMany({
      where: { companyId, userId },
      select: { id: true },
    })
  ).map((transaction) => transaction.id);

  if (buyerTransactionIds.length === 0) return [];

  const rows = await hydrateAgreementRows(
    companyId,
    await saFindMany({
      where: {
        companyId,
        status: { in: ["ACTIVE", "COMPLETED"] },
        transactionId: { in: buyerTransactionIds },
      },
      orderBy: { sentAt: "desc" },
      select: agreementSelect,
    }),
  );

  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      downloadUrl: await getPrivateDownloadUrl(row.document.storageKey),
    })),
  );
}

// ─── Admin: list transactions WITHOUT a contract ────────────────────────────

export type TransactionWithoutContract = {
  id: string;
  currentStage: string;
  reservation: { reference: string } | null;
  user: { firstName: string | null; lastName: string | null };
  property: { title: string };
};

export async function getTransactionsWithoutContract(
  companyId: string,
): Promise<TransactionWithoutContract[]> {
  if (!featureFlags.hasDatabase) return [];

  const contractedTransactionIds = (
    await prisma.signedAgreement.findMany({
      where: { companyId },
      select: { transactionId: true },
    })
  ).map((agreement) => agreement.transactionId);

  const rows = await prisma.transaction.findMany({
    where: {
      companyId,
      ...(contractedTransactionIds.length > 0 ? { id: { notIn: contractedTransactionIds } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      currentStage: true,
      reservation: { select: { reference: true } },
      user: { select: { firstName: true, lastName: true } },
      property: { select: { title: true } },
    },
  });
  return rows as TransactionWithoutContract[];
}
