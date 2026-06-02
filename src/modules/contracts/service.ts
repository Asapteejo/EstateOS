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

import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import { prisma } from "@/lib/db/prisma";
import { env, featureFlags } from "@/lib/env";
import {
  createInAppNotification,
  getTenantOperatorRecipients,
  notifyManyUsers,
} from "@/lib/notifications/service";
import { r2 } from "@/lib/storage/r2";
import { assertTenantStorageKey, namespaceTenantStorageKey } from "@/lib/storage/paths";
import type { TenantContext } from "@/lib/tenancy/context";
import { rejectUnsafeCompanyIdInput } from "@/lib/tenancy/db";
import type { ContractSettingsInput } from "@/lib/validations/contracts";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PRODUCT_EVENT_NAMES, trackProductEvent } from "@/modules/analytics/activity";
import { renderContractPdf, type PdfImage } from "@/modules/contracts/pdf";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const contractSettingsDelegate = (prisma as any).companyContractSettings;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const generatedContractDelegate = (prisma as any).generatedContract;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const contractTemplateDelegate = (prisma as any).contractTemplate;

type SignedAgreementBaseRow = Awaited<ReturnType<typeof saFindFirst>>;
type ContractActorUserLookupDelegate = {
  findFirst: (args: {
    where: Record<string, unknown>;
    select: { id: true; companyId: true };
  }) => Promise<{ id: string; companyId: string | null } | null>;
};

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

export function resolveContractActorUserForWrite(input: {
  requestedUserId?: string | null;
  resolvedUserId?: string | null;
  isProduction: boolean;
}) {
  if (!input.requestedUserId) {
    return null;
  }

  if (input.resolvedUserId) {
    return input.resolvedUserId;
  }

  if (input.isProduction) {
    throw new Error("Contract actor user does not exist.");
  }

  return null;
}

export async function resolveContractActorDbUserId(
  context: Pick<TenantContext, "userId" | "email" | "companyId" | "isSuperAdmin">,
  options?: {
    userDelegate?: ContractActorUserLookupDelegate;
  },
) {
  if (!context.userId) return null;

  const userDelegate = options?.userDelegate ?? prisma.user;
  const user = await userDelegate.findFirst({
    where: {
      OR: [
        { id: context.userId },
        { clerkUserId: context.userId },
        ...(context.email ? [{ email: context.email }] : []),
      ],
      ...(context.isSuperAdmin || !context.companyId ? {} : { companyId: context.companyId }),
    },
    select: {
      id: true,
      companyId: true,
    },
  });

  const resolvedUserId =
    user && (context.isSuperAdmin || !context.companyId || user.companyId === context.companyId)
      ? user.id
      : null;

  return resolveContractActorUserForWrite({
    requestedUserId: context.userId,
    resolvedUserId,
    isProduction: featureFlags.isProduction,
  });
}

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
  const [transaction, document] = await Promise.all([
    prisma.transaction.findFirst({
      where: {
        id: input.transactionId,
        companyId: input.companyId,
      },
      select: {
        id: true,
      },
    }),
    prisma.document.findFirst({
      where: {
        id: input.documentId,
        companyId: input.companyId,
        documentType: "CONTRACT",
      },
      select: {
        id: true,
        transactionId: true,
      },
    }),
  ]);
  if (!transaction) {
    throw new Error("Transaction not found for this tenant.");
  }
  if (!document || (document.transactionId && document.transactionId !== transaction.id)) {
    throw new Error("Contract document not found for this tenant transaction.");
  }

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
      where: { id: input.signedAgreementId, companyId: input.companyId },
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
      where: { id: input.signedAgreementId, companyId: input.companyId },
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
      downloadUrl: `/api/documents/${row.document.id}/download`,
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
  const generatedTransactionIds = generatedContractDelegate
    ? (
        await generatedContractDelegate.findMany({
          where: { companyId, transactionId: { not: null }, status: { in: ["DRAFT", "PENDING_REVIEW", "ACTIVE"] } },
          select: { transactionId: true },
        })
      )
        .map((contract: { transactionId: string | null }) => contract.transactionId)
        .filter((id: string | null): id is string => Boolean(id))
    : [];
  const unavailableTransactionIds = [...new Set([...contractedTransactionIds, ...generatedTransactionIds])];

  const rows = await prisma.transaction.findMany({
    where: {
      companyId,
      ...(unavailableTransactionIds.length > 0 ? { id: { notIn: unavailableTransactionIds } } : {}),
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

export type ContractSettingsReadiness = {
  ceoName: boolean;
  ceoTitle: boolean;
  signatureUploaded: boolean;
  stampUploaded: boolean;
  contractTermsPresent: boolean;
  isConfigured: boolean;
};

export type ContractSettingsRow = {
  id: string;
  companyId: string;
  ceoName: string;
  ceoTitle: string;
  signatureKey: string | null;
  stampKey: string | null;
  contractTerms: string | null;
  footerLegalText: string | null;
  isConfigured: boolean;
  readiness: ContractSettingsReadiness;
};

export type ContractTemplateMode = "SYSTEM_TEMPLATE" | "UPLOADED_PDF_TEMPLATE";

export type ContractTemplateRow = {
  id: string;
  companyId: string;
  mode: ContractTemplateMode;
  version: number;
  isActive: boolean;
  isConfigured: boolean;
  documentId: string | null;
  storageKey: string | null;
  fieldMappings: Prisma.JsonValue | null;
  ceoName: string;
  ceoTitle: string;
  signatureKey: string | null;
  stampKey: string | null;
  contractTerms: string | null;
  footerLegalText: string | null;
  replacedByTemplateId: string | null;
  archivedAt: Date | null;
  createdByUserId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: { firstName: string | null; lastName: string | null; email: string | null } | null;
  document?: { id: string; fileName: string; storageKey: string } | null;
};

export type ContractTemplateSnapshot = {
  templateId: string | null;
  templateVersion: number | null;
  templateMode: ContractTemplateMode;
  ceoName: string;
  ceoTitle: string;
  templateFileName: string | null;
  footerLegalTextHash: string | null;
  fieldMappingsHash: string | null;
};

export function buildContractSettingsReadiness(settings: {
  ceoName?: string | null;
  ceoTitle?: string | null;
  signatureKey?: string | null;
  stampKey?: string | null;
  contractTerms?: string | null;
}) {
  const readiness = {
    ceoName: Boolean(settings.ceoName?.trim()),
    ceoTitle: Boolean(settings.ceoTitle?.trim()),
    signatureUploaded: Boolean(settings.signatureKey?.trim()),
    stampUploaded: Boolean(settings.stampKey?.trim()),
    contractTermsPresent: Boolean(settings.contractTerms?.trim()),
    isConfigured: false,
  };
  readiness.isConfigured =
    readiness.ceoName &&
    readiness.ceoTitle &&
    readiness.signatureUploaded &&
    readiness.stampUploaded &&
    readiness.contractTermsPresent;
  return readiness;
}

export function assertTenantContractAssetKeys(
  context: Pick<TenantContext, "companyId" | "companySlug">,
  settings: Pick<ContractSettingsInput, "signatureKey" | "stampKey">,
) {
  assertTenantStorageKey(context, settings.signatureKey);
  assertTenantStorageKey(context, settings.stampKey);
}

function withReadiness(row: Omit<ContractSettingsRow, "readiness">): ContractSettingsRow {
  const readiness = buildContractSettingsReadiness(row);
  return { ...row, isConfigured: readiness.isConfigured, readiness };
}

function stableJson(value: unknown): string {
  if (value == null) return "";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
}

async function sha256Hex(value: string | null | undefined) {
  if (!value) return null;
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function buildTemplateSnapshot(template: ContractTemplateRow | null): Promise<ContractTemplateSnapshot> {
  return {
    templateId: template?.id ?? null,
    templateVersion: template?.version ?? null,
    templateMode: template?.mode ?? "SYSTEM_TEMPLATE",
    ceoName: template?.ceoName ?? "",
    ceoTitle: template?.ceoTitle ?? "",
    templateFileName: template?.document?.fileName ?? null,
    footerLegalTextHash: await sha256Hex(template?.footerLegalText),
    fieldMappingsHash: await sha256Hex(stableJson(template?.fieldMappings)),
  };
}

async function getNextTemplateVersion(companyId: string) {
  if (!contractTemplateDelegate) return 1;
  const latest = await contractTemplateDelegate.findFirst({
    where: { companyId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return (latest?.version ?? 0) + 1;
}

function templatesEquivalent(
  left: (Pick<ContractTemplateRow, "mode" | "ceoName" | "ceoTitle" | "signatureKey" | "stampKey" | "contractTerms" | "footerLegalText" | "documentId" | "storageKey"> & { fieldMappings: unknown }) | null,
  right: Pick<ContractTemplateRow, "mode" | "ceoName" | "ceoTitle" | "signatureKey" | "stampKey" | "contractTerms" | "footerLegalText" | "documentId" | "storageKey"> & { fieldMappings: unknown },
) {
  if (!left) return false;
  return (
    left.mode === right.mode &&
    left.ceoName === right.ceoName &&
    left.ceoTitle === right.ceoTitle &&
    (left.signatureKey ?? null) === (right.signatureKey ?? null) &&
    (left.stampKey ?? null) === (right.stampKey ?? null) &&
    (left.contractTerms ?? null) === (right.contractTerms ?? null) &&
    (left.footerLegalText ?? null) === (right.footerLegalText ?? null) &&
    (left.documentId ?? null) === (right.documentId ?? null) &&
    (left.storageKey ?? null) === (right.storageKey ?? null) &&
    stableJson(left.fieldMappings) === stableJson(right.fieldMappings)
  );
}

export function assertTemplateCanBeMutated(input: {
  generatedContractsCount: number;
}) {
  if (input.generatedContractsCount > 0) {
    throw new Error("This contract template version has generated buyer contracts and cannot be mutated. Create a new version instead.");
  }
}

export async function getCompanyContractTemplates(companyId: string): Promise<ContractTemplateRow[]> {
  if (!featureFlags.hasDatabase || !contractTemplateDelegate) return [];
  return contractTemplateDelegate.findMany({
    where: { companyId },
    orderBy: [{ version: "desc" }],
    select: {
      id: true,
      companyId: true,
      mode: true,
      version: true,
      isActive: true,
      isConfigured: true,
      documentId: true,
      storageKey: true,
      fieldMappings: true,
      ceoName: true,
      ceoTitle: true,
      signatureKey: true,
      stampKey: true,
      contractTerms: true,
      footerLegalText: true,
      replacedByTemplateId: true,
      archivedAt: true,
      createdByUserId: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { firstName: true, lastName: true, email: true } },
      document: { select: { id: true, fileName: true, storageKey: true } },
    },
  });
}

async function getActiveContractTemplate(companyId: string): Promise<ContractTemplateRow | null> {
  const templates = await getCompanyContractTemplates(companyId);
  return templates.find((template) => template.isActive && !template.archivedAt) ?? null;
}

async function getContractTemplateById(companyId: string, templateId: string): Promise<ContractTemplateRow | null> {
  if (!featureFlags.hasDatabase || !contractTemplateDelegate) return null;
  const template = await contractTemplateDelegate.findFirst({
    where: { id: templateId, companyId },
    select: {
      id: true,
      companyId: true,
      mode: true,
      version: true,
      isActive: true,
      isConfigured: true,
      documentId: true,
      storageKey: true,
      fieldMappings: true,
      ceoName: true,
      ceoTitle: true,
      signatureKey: true,
      stampKey: true,
      contractTerms: true,
      footerLegalText: true,
      replacedByTemplateId: true,
      archivedAt: true,
      createdByUserId: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { firstName: true, lastName: true, email: true } },
      document: { select: { id: true, fileName: true, storageKey: true } },
    },
  });
  return template;
}

export async function createContractTemplateVersion(input: {
  companyId: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorIsSuperAdmin?: boolean;
  mode?: ContractTemplateMode;
  ceoName: string;
  ceoTitle: string;
  signatureKey?: string | null;
  stampKey?: string | null;
  contractTerms?: string | null;
  footerLegalText?: string | null;
  documentId?: string | null;
  storageKey?: string | null;
  fieldMappings?: Prisma.InputJsonValue | null;
  notes?: string | null;
}) {
  if (!featureFlags.hasDatabase || !contractTemplateDelegate) return null;

  const mode = input.mode ?? "SYSTEM_TEMPLATE";
  const templateDocument = input.documentId
    ? await prisma.document.findFirst({
        where: {
          id: input.documentId,
          companyId: input.companyId,
        },
        select: {
          id: true,
          storageKey: true,
        },
      })
    : null;
  if (input.documentId && !templateDocument) {
    throw new Error("Contract template document not found for this tenant.");
  }
  if (input.storageKey && !templateDocument) {
    throw new Error("Contract template storage requires a tenant-owned document.");
  }
  if (input.storageKey && templateDocument?.storageKey !== input.storageKey) {
    throw new Error("Contract template storage key does not match its document.");
  }
  const templateStorageKey = templateDocument?.storageKey ?? null;
  const nextTemplateData = {
    mode,
    ceoName: input.ceoName,
    ceoTitle: input.ceoTitle,
    signatureKey: input.signatureKey ?? null,
    stampKey: input.stampKey ?? null,
    contractTerms: input.contractTerms ?? null,
    footerLegalText: input.footerLegalText ?? null,
    documentId: input.documentId ?? null,
    storageKey: templateStorageKey,
    fieldMappings: input.fieldMappings ?? null,
  };
  const active = await getActiveContractTemplate(input.companyId);
  if (templatesEquivalent(active, nextTemplateData)) {
    return active;
  }

  const version = await getNextTemplateVersion(input.companyId);
  const readiness = buildContractSettingsReadiness(input);
  const actorDbUserId = await resolveContractActorDbUserId({
    userId: input.actorUserId ?? null,
    email: input.actorEmail ?? null,
    companyId: input.companyId,
    isSuperAdmin: Boolean(input.actorIsSuperAdmin),
  });

  const created = await prisma.$transaction(async (tx) => {
    const contractTemplate = (tx as typeof tx & {
      contractTemplate: {
        updateMany: (args: unknown) => Promise<unknown>;
        create: (args: unknown) => Promise<ContractTemplateRow>;
      };
    }).contractTemplate;

    const existingActive = active;
    await contractTemplate.updateMany({
      where: { companyId: input.companyId, isActive: true },
      data: { isActive: false },
    });

    const createdTemplate = await contractTemplate.create({
      data: {
        companyId: input.companyId,
        mode,
        version,
        isActive: true,
        isConfigured: readiness.isConfigured,
        documentId: input.documentId ?? null,
        storageKey: templateStorageKey,
        fieldMappings: input.fieldMappings ?? undefined,
        ceoName: input.ceoName,
        ceoTitle: input.ceoTitle,
        signatureKey: input.signatureKey ?? null,
        stampKey: input.stampKey ?? null,
        contractTerms: input.contractTerms ?? null,
        footerLegalText: input.footerLegalText ?? null,
        createdByUserId: actorDbUserId,
        notes: input.notes ?? null,
      },
      select: {
        id: true,
        companyId: true,
        mode: true,
        version: true,
        isActive: true,
        isConfigured: true,
        documentId: true,
        storageKey: true,
        fieldMappings: true,
        ceoName: true,
        ceoTitle: true,
        signatureKey: true,
        stampKey: true,
        contractTerms: true,
        footerLegalText: true,
        replacedByTemplateId: true,
        archivedAt: true,
        createdByUserId: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (existingActive) {
      await contractTemplate.updateMany({
        where: { id: existingActive.id, companyId: input.companyId },
        data: { replacedByTemplateId: createdTemplate.id },
      });
    }

    return createdTemplate;
  });

  await writeAuditLog({
    companyId: input.companyId,
    actorUserId: actorDbUserId ?? undefined,
    action: "CREATE",
    entityType: "ContractTemplate",
    entityId: created.id,
    summary: `Created contract template v${created.version}`,
    payload: { mode: created.mode, isConfigured: created.isConfigured } as Prisma.InputJsonValue,
  });

  await writeAuditLog({
    companyId: input.companyId,
    actorUserId: actorDbUserId ?? undefined,
    action: "UPDATE",
    entityType: "ContractTemplate",
    entityId: created.id,
    summary: `Activated contract template v${created.version}`,
    payload: { mode: created.mode, version: created.version } as Prisma.InputJsonValue,
  });

  if (active) {
    await writeAuditLog({
      companyId: input.companyId,
      actorUserId: actorDbUserId ?? undefined,
      action: "UPDATE",
      entityType: "ContractTemplate",
      entityId: active.id,
      summary: `Replaced contract template v${active.version} with v${created.version}`,
      payload: { replacedByTemplateId: created.id, replacedByVersion: created.version } as Prisma.InputJsonValue,
    });
  }

  return created;
}

export async function archiveContractTemplateVersion(input: {
  companyId: string;
  templateId: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorIsSuperAdmin?: boolean;
}) {
  if (!featureFlags.hasDatabase || !contractTemplateDelegate) return null;

  const template = await getContractTemplateById(input.companyId, input.templateId);
  if (!template) {
    throw new Error("Contract template version not found.");
  }

  const archived = await contractTemplateDelegate.update({
    where: { id: template.id, companyId: input.companyId },
    data: {
      isActive: false,
      archivedAt: template.archivedAt ?? new Date(),
    },
    select: {
      id: true,
      companyId: true,
      mode: true,
      version: true,
      isActive: true,
      isConfigured: true,
      documentId: true,
      storageKey: true,
      fieldMappings: true,
      ceoName: true,
      ceoTitle: true,
      signatureKey: true,
      stampKey: true,
      contractTerms: true,
      footerLegalText: true,
      replacedByTemplateId: true,
      archivedAt: true,
      createdByUserId: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const actorDbUserId = await resolveContractActorDbUserId({
    userId: input.actorUserId ?? null,
    email: input.actorEmail ?? null,
    companyId: input.companyId,
    isSuperAdmin: Boolean(input.actorIsSuperAdmin),
  });

  await writeAuditLog({
    companyId: input.companyId,
    actorUserId: actorDbUserId ?? undefined,
    action: "UPDATE",
    entityType: "ContractTemplate",
    entityId: template.id,
    summary: `Archived contract template v${template.version}`,
    payload: { mode: template.mode, version: template.version } as Prisma.InputJsonValue,
  });

  return archived;
}

export async function activateContractTemplateVersion(input: {
  companyId: string;
  templateId: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorIsSuperAdmin?: boolean;
}) {
  if (!featureFlags.hasDatabase || !contractTemplateDelegate) return null;

  const template = await getContractTemplateById(input.companyId, input.templateId);
  if (!template) {
    throw new Error("Contract template version not found.");
  }
  if (!template.isConfigured) {
    throw new Error("Only configured contract template versions can be activated.");
  }

  const currentActive = await getActiveContractTemplate(input.companyId);
  const actorDbUserId = await resolveContractActorDbUserId({
    userId: input.actorUserId ?? null,
    email: input.actorEmail ?? null,
    companyId: input.companyId,
    isSuperAdmin: Boolean(input.actorIsSuperAdmin),
  });
  const activated = await prisma.$transaction(async (tx) => {
    const contractTemplate = (tx as typeof tx & {
      contractTemplate: {
        updateMany: (args: unknown) => Promise<unknown>;
        update: (args: unknown) => Promise<ContractTemplateRow>;
      };
    }).contractTemplate;

    await contractTemplate.updateMany({
      where: { companyId: input.companyId, isActive: true },
      data: { isActive: false },
    });

    return contractTemplate.update({
      where: { id: template.id, companyId: input.companyId },
      data: { isActive: true, archivedAt: null },
      select: {
        id: true,
        companyId: true,
        mode: true,
        version: true,
        isActive: true,
        isConfigured: true,
        documentId: true,
        storageKey: true,
        fieldMappings: true,
        ceoName: true,
        ceoTitle: true,
        signatureKey: true,
        stampKey: true,
        contractTerms: true,
        footerLegalText: true,
        replacedByTemplateId: true,
        archivedAt: true,
        createdByUserId: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  await writeAuditLog({
    companyId: input.companyId,
    actorUserId: actorDbUserId ?? undefined,
    action: "UPDATE",
    entityType: "ContractTemplate",
    entityId: template.id,
    summary: currentActive && currentActive.id !== template.id
      ? `Rolled back active contract template to v${template.version}`
      : `Activated contract template v${template.version}`,
    payload: {
      mode: template.mode,
      version: template.version,
      previousActiveTemplateId: currentActive?.id ?? null,
      previousActiveVersion: currentActive?.version ?? null,
    } as Prisma.InputJsonValue,
  });

  return activated;
}

export async function getCompanyContractSettings(context: TenantContext): Promise<ContractSettingsRow | null> {
  if (!featureFlags.hasDatabase || !context.companyId || !contractSettingsDelegate) {
    return null;
  }

  const row = await contractSettingsDelegate.findUnique({
    where: { companyId: context.companyId },
    select: {
      id: true,
      companyId: true,
      ceoName: true,
      ceoTitle: true,
      signatureKey: true,
      stampKey: true,
      contractTerms: true,
      footerLegalText: true,
      isConfigured: true,
    },
  });

  return row ? withReadiness(row) : null;
}

export async function upsertCompanyContractSettings(
  context: TenantContext,
  rawInput: ContractSettingsInput & Record<string, unknown>,
) {
  rejectUnsafeCompanyIdInput(rawInput);
  if (!context.companyId) {
    throw new Error("Tenant context is required.");
  }
  assertTenantContractAssetKeys(context, rawInput);
  if (!featureFlags.hasDatabase || !contractSettingsDelegate) {
    return withReadiness({
      id: "demo-contract-settings",
      companyId: context.companyId,
      ceoName: rawInput.ceoName,
      ceoTitle: rawInput.ceoTitle,
      signatureKey: rawInput.signatureKey ?? null,
      stampKey: rawInput.stampKey ?? null,
      contractTerms: rawInput.contractTerms ?? null,
      footerLegalText: rawInput.footerLegalText ?? null,
      isConfigured: false,
    });
  }

  const readiness = buildContractSettingsReadiness(rawInput);
  const saved = await contractSettingsDelegate.upsert({
    where: { companyId: context.companyId },
    update: {
      ceoName: rawInput.ceoName,
      ceoTitle: rawInput.ceoTitle,
      signatureKey: rawInput.signatureKey ?? null,
      stampKey: rawInput.stampKey ?? null,
      contractTerms: rawInput.contractTerms ?? null,
      footerLegalText: rawInput.footerLegalText ?? null,
      isConfigured: readiness.isConfigured,
    },
    create: {
      companyId: context.companyId,
      ceoName: rawInput.ceoName,
      ceoTitle: rawInput.ceoTitle,
      signatureKey: rawInput.signatureKey ?? null,
      stampKey: rawInput.stampKey ?? null,
      contractTerms: rawInput.contractTerms ?? null,
      footerLegalText: rawInput.footerLegalText ?? null,
      isConfigured: readiness.isConfigured,
    },
    select: {
      id: true,
      companyId: true,
      ceoName: true,
      ceoTitle: true,
      signatureKey: true,
      stampKey: true,
      contractTerms: true,
      footerLegalText: true,
      isConfigured: true,
    },
  });

  const actorDbUserId = await resolveContractActorDbUserId(context);
  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: actorDbUserId ?? undefined,
    action: "UPDATE",
    entityType: "CompanyContractSettings",
    entityId: saved.id,
    summary: "Updated contract generation settings",
    payload: {
      isConfigured: readiness.isConfigured,
      signatureUploaded: readiness.signatureUploaded,
      stampUploaded: readiness.stampUploaded,
    } as Prisma.InputJsonValue,
  });

  await createContractTemplateVersion({
    companyId: context.companyId,
    actorUserId: context.userId,
    actorEmail: context.email,
    actorIsSuperAdmin: context.isSuperAdmin,
    mode: "SYSTEM_TEMPLATE",
    ceoName: rawInput.ceoName,
    ceoTitle: rawInput.ceoTitle,
    signatureKey: rawInput.signatureKey ?? null,
    stampKey: rawInput.stampKey ?? null,
    contractTerms: rawInput.contractTerms ?? null,
    footerLegalText: rawInput.footerLegalText ?? null,
    notes: "Created from contract settings save.",
  });

  return withReadiness(saved);
}

function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body || typeof body !== "object") return Promise.resolve(Buffer.alloc(0));
  if ("transformToByteArray" in body && typeof body.transformToByteArray === "function") {
    return body.transformToByteArray().then((bytes: Uint8Array) => Buffer.from(bytes));
  }
  if ("arrayBuffer" in body && typeof body.arrayBuffer === "function") {
    return body.arrayBuffer().then((bytes: ArrayBuffer) => Buffer.from(bytes));
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = body as NodeJS.ReadableStream;
    stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

async function loadPrivateContractImage(storageKey: string | null | undefined): Promise<PdfImage | null> {
  if (!storageKey || !r2 || !env.R2_BUCKET_NAME) {
    return null;
  }

  try {
    const object = await r2.send(new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: storageKey }));
    const input = await streamToBuffer(object.Body);
    const sharpModule = await import("sharp").catch(() => null);
    const sharp = sharpModule?.default;
    if (!sharp) return null;
    const image = sharp(input).flatten({ background: "#ffffff" }).jpeg({ quality: 88 });
    const metadata = await image.metadata();
    const bytes = await image.toBuffer();
    if (!metadata.width || !metadata.height) return null;
    return { bytes, width: metadata.width, height: metadata.height, format: "jpeg" };
  } catch {
    return null;
  }
}

function buildContractNumber(input: { companySlug: string; transactionId?: string | null; paymentId?: string | null; version: number }) {
  const suffix = (input.transactionId ?? input.paymentId ?? crypto.randomUUID()).replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase();
  const version = String(input.version).padStart(2, "0");
  return `COS-${input.companySlug.toUpperCase()}-${suffix}-V${version}`;
}

export type GeneratedContractRow = {
  id: string;
  companyId: string;
  buyerUserId: string;
  propertyId: string | null;
  transactionId: string | null;
  paymentRequestId: string | null;
  paymentId: string | null;
  documentId: string;
  templateId: string | null;
  templateVersion: number | null;
  templateMode: ContractTemplateMode;
  templateSnapshot: Prisma.JsonValue | null;
  regeneratedFromContractId: string | null;
  contractNumber: string;
  status: "DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "VOIDED" | "REGENERATED";
  generatedAt: Date;
  version: number;
  document: { id: string; fileName: string; storageKey: string; mimeType: string | null };
  buyer: { firstName: string | null; lastName: string | null; email: string | null };
  property: { title: string } | null;
};

const generatedContractSelect = {
  id: true,
  companyId: true,
  buyerUserId: true,
  propertyId: true,
  transactionId: true,
  paymentRequestId: true,
  paymentId: true,
  documentId: true,
  templateId: true,
  templateVersion: true,
  templateMode: true,
  templateSnapshot: true,
  regeneratedFromContractId: true,
  contractNumber: true,
  status: true,
  generatedAt: true,
  version: true,
  document: { select: { id: true, fileName: true, storageKey: true, mimeType: true } },
  buyer: { select: { firstName: true, lastName: true, email: true } },
  property: { select: { title: true } },
};

export async function generateContractForTransaction(input: {
  companyId: string;
  companySlug: string;
  transactionId: string;
  paymentId?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorIsSuperAdmin?: boolean;
  forceRegenerate?: boolean;
  templateId?: string | null;
  regeneratedFromContractId?: string | null;
}): Promise<GeneratedContractRow> {
  if (!featureFlags.hasDatabase || !generatedContractDelegate) {
    throw new Error("Database is required for contract generation.");
  }

  const existing = await generatedContractDelegate.findFirst({
    where: {
      companyId: input.companyId,
      transactionId: input.transactionId,
      status: { in: ["DRAFT", "PENDING_REVIEW", "ACTIVE"] },
    },
    orderBy: { version: "desc" },
    select: generatedContractSelect,
  });
  if (existing && !input.forceRegenerate) {
    return existing;
  }
  if (input.regeneratedFromContractId) {
    const regeneratedFrom = await generatedContractDelegate.findFirst({
      where: {
        id: input.regeneratedFromContractId,
        companyId: input.companyId,
        transactionId: input.transactionId,
      },
      select: {
        id: true,
      },
    });
    if (!regeneratedFrom) {
      throw new Error("Original generated contract not found for this tenant transaction.");
    }
  }

  const [settings, transaction, priorLatest, explicitTemplate, activeTemplate] = await Promise.all([
    contractSettingsDelegate.findUnique({
      where: { companyId: input.companyId },
      select: {
        ceoName: true,
        ceoTitle: true,
        signatureKey: true,
        stampKey: true,
        contractTerms: true,
        footerLegalText: true,
        isConfigured: true,
      },
    }),
    prisma.transaction.findFirst({
      where: { companyId: input.companyId, id: input.transactionId },
      select: {
        id: true,
        companyId: true,
        userId: true,
        propertyId: true,
        outstandingBalance: true,
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
        company: {
          select: {
            name: true,
            slug: true,
            legalName: true,
            siteSetting: { select: { address: true, supportEmail: true, supportPhone: true } },
          },
        },
        property: {
          select: {
            title: true,
            location: { select: { addressLine1: true, city: true, state: true, country: true } },
          },
        },
        propertyUnit: { select: { title: true } },
        paymentRequests: {
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { id: true },
        },
        payments: {
          where: { status: "SUCCESS" },
          orderBy: { paidAt: "desc" },
          take: 1,
          select: {
            id: true,
            providerReference: true,
            amount: true,
            currency: true,
            paidAt: true,
          },
        },
      },
    }),
    generatedContractDelegate.findFirst({
      where: { companyId: input.companyId, transactionId: input.transactionId },
      orderBy: { version: "desc" },
      select: { version: true },
    }),
    input.templateId ? getContractTemplateById(input.companyId, input.templateId) : Promise.resolve(null),
    getActiveContractTemplate(input.companyId),
  ]);

  const template = explicitTemplate ?? activeTemplate;
  if (input.templateId && !explicitTemplate) {
    throw new Error("Contract template version not found.");
  }
  if (template?.mode === "UPLOADED_PDF_TEMPLATE") {
    throw new Error("Uploaded PDF contract templates are versioned but PDF field filling is not implemented yet.");
  }
  const renderSource = template ?? settings;
  const readiness = buildContractSettingsReadiness(renderSource ?? {});
  if (!renderSource || !readiness.isConfigured || ("isConfigured" in renderSource && !renderSource.isConfigured)) {
    throw new Error("Contract settings are incomplete.");
  }
  if (!transaction) {
    throw new Error("Transaction not found.");
  }
  const actorDbUserId = await resolveContractActorDbUserId({
    userId: input.actorUserId ?? null,
    email: input.actorEmail ?? null,
    companyId: input.companyId,
    isSuperAdmin: Boolean(input.actorIsSuperAdmin),
  });

  const latestPayment =
    input.paymentId && transaction.payments.find((payment) => payment.id === input.paymentId)
      ? transaction.payments.find((payment) => payment.id === input.paymentId)!
      : transaction.payments[0];
  if (!latestPayment) {
    throw new Error("A successful payment is required before generating a contract.");
  }

  const version = input.forceRegenerate ? (priorLatest?.version ?? 0) + 1 : 1;
  const contractNumber = buildContractNumber({
    companySlug: transaction.company.slug,
    transactionId: transaction.id,
    paymentId: latestPayment.id,
    version,
  });
  const locationParts = [
    transaction.property.location?.addressLine1,
    transaction.property.location?.city,
    transaction.property.location?.state,
    transaction.property.location?.country,
  ].filter(Boolean);
  assertTenantContractAssetKeys(
    {
      companyId: input.companyId,
      companySlug: transaction.company.slug,
    },
    renderSource,
  );
  const [signatureImage, stampImage] = await Promise.all([
    loadPrivateContractImage(renderSource.signatureKey),
    loadPrivateContractImage(renderSource.stampKey),
  ]);
  const templateSnapshot: ContractTemplateSnapshot = template
    ? await buildTemplateSnapshot(template)
    : {
        templateId: null,
        templateVersion: null,
        templateMode: "SYSTEM_TEMPLATE",
        ceoName: renderSource.ceoName,
        ceoTitle: renderSource.ceoTitle,
        templateFileName: null,
        footerLegalTextHash: await sha256Hex(renderSource.footerLegalText),
        fieldMappingsHash: null,
      };
  const pdfBytes = renderContractPdf({
    contractNumber,
    generatedDate: formatDate(new Date(), "PPP"),
    company: {
      name: transaction.company.name,
      legalName: transaction.company.legalName,
      address: transaction.company.siteSetting?.address ?? null,
      email: transaction.company.siteSetting?.supportEmail ?? null,
      phone: transaction.company.siteSetting?.supportPhone ?? null,
    },
    buyer: {
      name: `${transaction.user.firstName ?? ""} ${transaction.user.lastName ?? ""}`.trim() || "Buyer",
      email: transaction.user.email,
      phone: transaction.user.phone,
    },
    property: {
      title: transaction.property.title,
      unitTitle: transaction.propertyUnit?.title ?? null,
      location: locationParts.join(", ") || null,
    },
    payment: {
      reference: latestPayment.providerReference,
      amount: formatCurrency(latestPayment.amount.toNumber?.() ?? Number(latestPayment.amount)),
      currency: latestPayment.currency,
      paidAt: latestPayment.paidAt ? formatDate(latestPayment.paidAt, "PPP") : formatDate(new Date(), "PPP"),
    },
    signatory: {
      name: renderSource.ceoName,
      title: renderSource.ceoTitle,
    },
    terms: renderSource.contractTerms ?? "",
    footerLegalText: renderSource.footerLegalText,
    signatureImage,
    stampImage,
  });

  const storageKey = namespaceTenantStorageKey(
    {
      companyId: input.companyId,
      companySlug: input.companySlug,
    },
    "contracts/generated",
    `${contractNumber}.pdf`,
    crypto.randomUUID(),
  );

  if (r2 && env.R2_BUCKET_NAME) {
    await r2.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: storageKey,
        Body: pdfBytes,
        ContentType: "application/pdf",
      }),
    );
  }

  const created = await prisma.$transaction(async (tx) => {
    if (input.forceRegenerate) {
      await (tx as typeof tx & { generatedContract: { updateMany: (args: unknown) => Promise<unknown> } }).generatedContract.updateMany({
        where: {
          companyId: input.companyId,
          transactionId: input.transactionId,
          status: { in: ["DRAFT", "PENDING_REVIEW", "ACTIVE"] },
        },
        data: { status: "REGENERATED" },
      });
    }

    const document = await tx.document.create({
      data: {
        companyId: input.companyId,
        userId: transaction.userId,
        transactionId: transaction.id,
        fileName: `${contractNumber}.pdf`,
        storageKey,
        mimeType: "application/pdf",
        sizeBytes: pdfBytes.length,
        documentType: "CONTRACT",
        visibility: "PRIVATE",
        uploadedByUserId: actorDbUserId ?? undefined,
        createdForUserId: transaction.userId,
        metadata: {
          generatedContract: true,
          contractNumber,
          version,
          paymentId: latestPayment.id,
        } as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    return (tx as typeof tx & { generatedContract: { create: (args: unknown) => Promise<GeneratedContractRow> } }).generatedContract.create({
      data: {
        companyId: input.companyId,
        buyerUserId: transaction.userId,
        propertyId: transaction.propertyId,
        transactionId: transaction.id,
        paymentRequestId: transaction.paymentRequests[0]?.id ?? null,
        paymentId: latestPayment.id,
        documentId: document.id,
        templateId: template?.id ?? null,
        templateVersion: template?.version ?? null,
        templateMode: template?.mode ?? "SYSTEM_TEMPLATE",
        templateSnapshot: templateSnapshot as unknown as Prisma.InputJsonValue,
        regeneratedFromContractId: input.regeneratedFromContractId ?? null,
        contractNumber,
        status: "ACTIVE",
        generatedAt: new Date(),
        generatedByUserId: actorDbUserId,
        version,
      },
      select: generatedContractSelect,
    });
  });

  await createInAppNotification({
    companyId: input.companyId,
    userId: transaction.userId,
    type: "DOCUMENT_REQUESTED",
    title: "Your Contract of Sale is ready",
    body: `Your Contract of Sale for ${transaction.property.title} is ready to download.`,
    metadata: {
      generatedContractId: created.id,
      documentId: created.documentId,
      href: "/portal/contracts",
      actionUrl: "/portal/contracts",
      entityType: "GeneratedContract",
      entityId: created.id,
    } as Prisma.InputJsonValue,
  });

  await writeAuditLog({
    companyId: input.companyId,
    actorUserId: actorDbUserId ?? undefined,
    action: input.regeneratedFromContractId ? "UPDATE" : "CREATE",
    entityType: "GeneratedContract",
    entityId: created.id,
    summary: input.regeneratedFromContractId
      ? `Regenerated Contract of Sale ${created.contractNumber}`
      : `Generated Contract of Sale ${created.contractNumber}`,
    payload: {
      transactionId: input.transactionId,
      paymentId: latestPayment.id,
      documentId: created.documentId,
      version,
      templateId: created.templateId,
      templateVersion: created.templateVersion,
      templateMode: created.templateMode,
      regeneratedFromContractId: input.regeneratedFromContractId ?? null,
    } as Prisma.InputJsonValue,
  });

  return created;
}

export async function attemptGenerateContractForSuccessfulPayment(input: {
  companyId: string;
  companySlug: string;
  paymentId: string;
}) {
  if (!featureFlags.hasDatabase) return null;

  const payment = await prisma.payment.findFirst({
    where: {
      companyId: input.companyId,
      id: input.paymentId,
      status: "SUCCESS",
      transactionId: { not: null },
    },
    select: {
      id: true,
      transactionId: true,
      transaction: {
        select: {
          id: true,
          outstandingBalance: true,
          userId: true,
        },
      },
    },
  });

  if (!payment?.transactionId || !payment.transaction) return null;
  const settings = await contractSettingsDelegate.findUnique({
    where: { companyId: input.companyId },
    select: { isConfigured: true },
  });
  const outstandingBalance = payment.transaction.outstandingBalance.toNumber?.() ?? Number(payment.transaction.outstandingBalance);
  const shouldGenerate = shouldTriggerContractGenerationAfterPayment({
    paymentStatus: "SUCCESS",
    outstandingBalance,
    isConfigured: Boolean(settings?.isConfigured),
  });

  if (outstandingBalance <= 0 && !settings?.isConfigured) {
    const operators = await getTenantOperatorRecipients(input.companyId);
    await notifyManyUsers(operators, {
      companyId: input.companyId,
      type: "DOCUMENT_REQUESTED",
      title: "Contract settings incomplete",
      body: "A buyer completed payment, but Contract of Sale generation is not configured yet.",
      metadata: {
        paymentId: input.paymentId,
        transactionId: payment.transactionId,
        href: "/admin/settings/contracts",
        actionUrl: "/admin/settings/contracts",
        entityType: "Payment",
        entityId: input.paymentId,
      } as Prisma.InputJsonValue,
    });
    return null;
  }
  if (!shouldGenerate) return null;

  try {
    return await generateContractForTransaction({
      companyId: input.companyId,
      companySlug: input.companySlug,
      transactionId: payment.transactionId,
      paymentId: input.paymentId,
    });
  } catch (error) {
    const operators = await getTenantOperatorRecipients(input.companyId);
    await notifyManyUsers(operators, {
      companyId: input.companyId,
      type: "DOCUMENT_REQUESTED",
      title: "Contract generation failed",
      body: error instanceof Error ? error.message : "Contract generation failed after successful payment.",
      metadata: {
        paymentId: input.paymentId,
        transactionId: payment.transactionId,
        href: "/admin/contracts",
        actionUrl: "/admin/contracts",
        entityType: "Payment",
        entityId: input.paymentId,
      } as Prisma.InputJsonValue,
    });
    return null;
  }
}

export function shouldTriggerContractGenerationAfterPayment(input: {
  paymentStatus: string;
  outstandingBalance: number;
  isConfigured: boolean;
}) {
  return input.paymentStatus === "SUCCESS" && input.outstandingBalance <= 0 && input.isConfigured;
}

export async function getAdminGeneratedContracts(companyId: string): Promise<GeneratedContractRow[]> {
  if (!featureFlags.hasDatabase || !generatedContractDelegate) return [];
  return generatedContractDelegate.findMany({
    where: { companyId },
    orderBy: [{ generatedAt: "desc" }, { version: "desc" }],
    select: generatedContractSelect,
  });
}

export async function getBuyerGeneratedContracts(userId: string, companyId: string): Promise<GeneratedContractRow[]> {
  if (!featureFlags.hasDatabase || !generatedContractDelegate) return [];
  return generatedContractDelegate.findMany({
    where: {
      companyId,
      buyerUserId: userId,
      status: { in: ["ACTIVE", "PENDING_REVIEW"] },
    },
    orderBy: [{ generatedAt: "desc" }, { version: "desc" }],
    select: generatedContractSelect,
  });
}
