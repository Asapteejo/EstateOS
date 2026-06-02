import { Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { assertDocumentAccess } from "@/lib/documents/access";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { renderKycStatusEmail } from "@/lib/notifications/templates";
import { isTenantStorageKey } from "@/lib/storage/paths";
import type { TenantContext } from "@/lib/tenancy/context";
import { findFirstForTenant, findManyForTenant, rejectUnsafeCompanyIdInput } from "@/lib/tenancy/db";
import type { AdminKycReviewInput, BuyerKycSubmissionInput } from "@/lib/validations/kyc";
import { resolveBuyerDbUserForKyc, resolveBuyerTenantContextForKyc } from "@/modules/kyc/buyer-user";
import {
  getBuyerProfileKycChecklist,
  getKycDocumentFormatMessage,
  isBuyerProfileReadyForKyc,
} from "@/modules/kyc/presentation";
import { deriveOverallKycStatus } from "@/modules/transactions/workflow";
import { syncTransactionMilestones } from "@/modules/transactions/mutations";

type ScopedFindFirstDelegate = { findFirst: (args?: unknown) => Promise<unknown> };
type ScopedFindManyDelegate = { findMany: (args?: unknown) => Promise<unknown> };

export type BuyerProfileRecord = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  profileImageUrl: string;
  dateOfBirth: string;
  nationality: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  occupation: string;
  nextOfKinName: string;
  nextOfKinPhone: string;
  profileCompleted: boolean;
};

export type BuyerKycSubmissionListItem = {
  id: string;
  documentType: string;
  identityDocumentType: string | null;
  country: string | null;
  fileName: string;
  status: string;
  notes: string | null;
  rejectionReason: string | null;
  requiredActions: string | null;
  reviewedAt: string | null;
  createdAt: string;
  downloadUrl: string;
  unsupportedFormatMessage: string | null;
};

export async function getBuyerProfileRecord(
  context: TenantContext,
  options?: { email?: string | null },
): Promise<BuyerProfileRecord | null> {
  if (!featureFlags.hasDatabase || !context.companyId || !context.userId) {
    return {
      firstName: "Ada",
      lastName: "Okafor",
      email: "buyer@acmerealty.dev",
      phone: "+2348010001111",
      profileImageUrl: "",
      dateOfBirth: "",
      nationality: "Nigerian",
      addressLine1: "12 Admiralty Way",
      addressLine2: "",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
      occupation: "Product Manager",
      nextOfKinName: "Chika Okafor",
      nextOfKinPhone: "+2348010002222",
      profileCompleted: true,
    };
  }

  const buyerContext = await resolveBuyerTenantContextForKyc(context, {
    email: options?.email,
  });

  const user = (await findFirstForTenant(
    prisma.user as ScopedFindFirstDelegate,
    buyerContext,
    {
      where: {
        id: buyerContext.userId,
      },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        profile: {
          select: {
            dateOfBirth: true,
            nationality: true,
            addressLine1: true,
            addressLine2: true,
            city: true,
            state: true,
            country: true,
            occupation: true,
            nextOfKinName: true,
            nextOfKinPhone: true,
            profileCompleted: true,
          },
        },
      },
    } as Parameters<typeof prisma.user.findFirst>[0],
  )) as {
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
    profile: {
      dateOfBirth: Date | null;
      nationality: string | null;
      addressLine1: string | null;
      addressLine2: string | null;
      city: string | null;
      state: string | null;
      country: string | null;
      occupation: string | null;
      nextOfKinName: string | null;
      nextOfKinPhone: string | null;
      profileCompleted: boolean;
    } | null;
  } | null;

  const imageRows = await prisma.$queryRaw<Array<{ profileImageUrl: string | null }>>(Prisma.sql`
    SELECT "profileImageUrl"
    FROM "User"
    WHERE "id" = ${buyerContext.userId}
      AND "companyId" = ${context.companyId}
    LIMIT 1
  `);

  if (!user) {
    return null;
  }

  return {
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    email: user.email,
    phone: user.phone ?? "",
    profileImageUrl: imageRows[0]?.profileImageUrl ?? "",
    dateOfBirth: user.profile?.dateOfBirth?.toISOString().slice(0, 10) ?? "",
    nationality: user.profile?.nationality ?? "",
    addressLine1: user.profile?.addressLine1 ?? "",
    addressLine2: user.profile?.addressLine2 ?? "",
    city: user.profile?.city ?? "",
    state: user.profile?.state ?? "",
    country: user.profile?.country ?? "Nigeria",
    occupation: user.profile?.occupation ?? "",
    nextOfKinName: user.profile?.nextOfKinName ?? "",
    nextOfKinPhone: user.profile?.nextOfKinPhone ?? "",
    profileCompleted: user.profile?.profileCompleted ?? false,
  };
}

export async function saveBuyerProfileRecord(
  context: TenantContext,
  input: Record<string, unknown> & {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    profileImageUrl?: string;
    dateOfBirth?: string;
    nationality?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    country: string;
    occupation?: string;
    nextOfKinName?: string;
    nextOfKinPhone?: string;
  },
  options?: { email?: string | null },
) {
  rejectUnsafeCompanyIdInput(input);

  if (!featureFlags.hasDatabase || !context.companyId || !context.userId) {
    return {
      profileCompleted: true,
    };
  }

  const buyerContext = await resolveBuyerTenantContextForKyc(context, {
    email: options?.email,
  });

  const updated = await prisma.user.update({
    where: {
      id: buyerContext.userId!,
    },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      profile: {
        upsert: {
          update: {
            dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
            nationality: input.nationality ?? "",
            addressLine1: input.addressLine1 ?? "",
            addressLine2: input.addressLine2,
            city: input.city ?? "",
            state: input.state ?? "",
            country: input.country,
            occupation: input.occupation ?? "",
            nextOfKinName: input.nextOfKinName ?? "",
            nextOfKinPhone: input.nextOfKinPhone ?? "",
            profileCompleted: true,
          },
          create: {
            dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
            nationality: input.nationality ?? "",
            addressLine1: input.addressLine1 ?? "",
            addressLine2: input.addressLine2,
            city: input.city ?? "",
            state: input.state ?? "",
            country: input.country,
            occupation: input.occupation ?? "",
            nextOfKinName: input.nextOfKinName ?? "",
            nextOfKinPhone: input.nextOfKinPhone ?? "",
            profileCompleted: true,
          },
        },
      },
    },
    select: {
      profile: {
        select: {
          profileCompleted: true,
        },
      },
    },
  });

  await prisma.$executeRaw(Prisma.sql`
    UPDATE "User"
    SET
      "profileImageUrl" = ${input.profileImageUrl ?? null},
      "updatedAt" = NOW()
    WHERE "id" = ${buyerContext.userId}
      AND "companyId" = ${context.companyId}
  `);

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: buyerContext.userId ?? undefined,
    action: "UPDATE",
    entityType: "Profile",
    entityId: buyerContext.userId!,
    summary: "Buyer profile updated",
  });

  return {
    profileCompleted: updated.profile?.profileCompleted ?? false,
  };
}

export async function getBuyerKycWorkspace(
  context: TenantContext,
  options?: { email?: string | null },
) {
  if (!featureFlags.hasDatabase || !context.companyId || !context.userId) {
    const demoProfile = await getBuyerProfileRecord(context, options);
    return {
      overallStatus: "NOT_SUBMITTED",
      profileReady: isBuyerProfileReadyForKyc(demoProfile),
      profileChecklist: getBuyerProfileKycChecklist(demoProfile),
      buyerCountry: demoProfile?.country ?? "Nigeria",
      submissions: [] as BuyerKycSubmissionListItem[],
    };
  }

  const buyerContext = await resolveBuyerTenantContextForKyc(context, {
    email: options?.email,
  });

  const submissions = (await findManyForTenant(
    prisma.kYCSubmission as ScopedFindManyDelegate,
    buyerContext,
    {
      where: {
        userId: buyerContext.userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        status: true,
        notes: true,
        rejectionReason: true,
        requiredActions: true,
        reviewedAt: true,
        createdAt: true,
        document: {
          select: {
            id: true,
            fileName: true,
            documentType: true,
            metadata: true,
            storageKey: true,
            mimeType: true,
            visibility: true,
            companyId: true,
            userId: true,
            transaction: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    } as Parameters<typeof prisma.kYCSubmission.findMany>[0],
  )) as Array<{
    id: string;
    status: string;
    notes: string | null;
    rejectionReason: string | null;
    requiredActions: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
    document: {
      id: string;
      fileName: string;
      documentType: string;
      metadata: Prisma.JsonValue | null;
      storageKey: string;
      mimeType: string | null;
      visibility: "PUBLIC" | "PRIVATE";
      companyId: string;
      userId: string | null;
      transaction: { userId: string } | null;
    };
  }>;

  const safeSubmissions: BuyerKycSubmissionListItem[] = [];

  for (const submission of submissions) {
    assertDocumentAccess(buyerContext, {
      id: submission.document.id,
      companyId: submission.document.companyId,
      userId: submission.document.userId,
      visibility: submission.document.visibility,
      fileName: submission.document.fileName,
      storageKey: submission.document.storageKey,
      mimeType: submission.document.mimeType,
      transaction: submission.document.transaction,
    });

    const downloadUrl =
      isTenantStorageKey(context, submission.document.storageKey)
        ? `/api/documents/${submission.document.id}/download`
        : "#";

    const metadata = submission.document.metadata as {
      identityDocumentType?: string | null;
      country?: string | null;
    } | null;

    safeSubmissions.push({
      id: submission.id,
      documentType: submission.document.documentType,
      identityDocumentType: metadata?.identityDocumentType ?? null,
      country: metadata?.country ?? null,
      fileName: submission.document.fileName,
      status: submission.status,
      notes: submission.notes,
      rejectionReason: submission.rejectionReason,
      requiredActions: submission.requiredActions,
      reviewedAt: submission.reviewedAt?.toISOString() ?? null,
      createdAt: submission.createdAt.toISOString(),
      downloadUrl,
      unsupportedFormatMessage: getKycDocumentFormatMessage(submission.document.mimeType),
    });
  }

  const profile = await getBuyerProfileRecord(context, options);

  return {
    overallStatus: deriveOverallKycStatus(safeSubmissions.map((item) => item.status)),
    profileReady: isBuyerProfileReadyForKyc(profile),
    profileChecklist: getBuyerProfileKycChecklist(profile),
    buyerCountry: profile?.country ?? "Nigeria",
    submissions: safeSubmissions,
  };
}

export async function createBuyerKycSubmission(
  context: TenantContext,
  input: BuyerKycSubmissionInput & Record<string, unknown>,
  options?: { email?: string | null },
) {
  rejectUnsafeCompanyIdInput(input);

  if (!context.companyId || !context.userId) {
    throw new Error("Authentication and tenant context are required.");
  }

  if (!isTenantStorageKey(context, input.storageKey)) {
    throw new Error("KYC document storage namespace mismatch.");
  }

  const profile = await getBuyerProfileRecord(context, options);
  if (!isBuyerProfileReadyForKyc(profile)) {
    throw new Error("Complete your profile first before submitting KYC.");
  }

  if (!featureFlags.hasDatabase) {
    return {
      status: "SUBMITTED",
    };
  }

  const buyer = await resolveBuyerDbUserForKyc(context, {
    email: options?.email,
  });

  const created = await prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        companyId: context.companyId!,
        userId: buyer.id,
        fileName: input.fileName,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        documentType: input.documentType,
        visibility: "PRIVATE",
        uploadedByUserId: buyer.id,
        createdForUserId: buyer.id,
        metadata: {
          notes: input.notes,
          country: input.country,
          identityDocumentType: input.identityDocumentType,
        } as Prisma.InputJsonValue,
      },
      select: {
        id: true,
      },
    });

    const submission = await tx.kYCSubmission.create({
      data: {
        companyId: context.companyId!,
        userId: buyer.id,
        documentId: document.id,
        status: "SUBMITTED",
        notes: input.notes,
        rejectionReason: null,
        requiredActions: null,
        reviewedAt: null,
      },
      select: {
        id: true,
        status: true,
      },
    });

    const transaction = await tx.transaction.findFirst({
      where: {
        companyId: context.companyId!,
        userId: buyer.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        currentStage: true,
      },
    });

    if (transaction && transaction.currentStage === "INQUIRY_RECEIVED") {
      await tx.transaction.update({
        where: {
          id: transaction.id,
          companyId: context.companyId!,
        },
        data: {
          currentStage: "KYC_SUBMITTED",
        },
      });

      await syncTransactionMilestones(tx, {
        companyId: context.companyId!,
        transactionId: transaction.id,
        currentStage: "KYC_SUBMITTED",
      });
    }

    return submission;
  });

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: buyer.id,
    action: "CREATE",
    entityType: "KYCSubmission",
    entityId: created.id,
    summary: `Submitted ${input.documentType} for KYC review`,
    payload: {
      documentType: input.documentType,
      country: input.country,
      identityDocumentType: input.identityDocumentType,
      fileName: input.fileName,
    } as Prisma.InputJsonValue,
  });

  return created;
}

export async function getAdminKycReviewQueue(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return [];
  }

  const queue = (await findManyForTenant(
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
        rejectionReason: true,
        requiredActions: true,
        reviewedAt: true,
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
            metadata: true,
            storageKey: true,
            companyId: true,
          },
        },
      },
    } as Parameters<typeof prisma.kYCSubmission.findMany>[0],
  )) as Array<{
    id: string;
    status: string;
    notes: string | null;
    rejectionReason: string | null;
    requiredActions: string | null;
    reviewedAt: Date | null;
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
      metadata: Prisma.JsonValue | null;
      storageKey: string;
      companyId: string;
    };
  }>;

  return queue.map((item) => {
    const metadata = item.document.metadata as {
      identityDocumentType?: string | null;
      country?: string | null;
    } | null;

    return {
    id: item.id,
    buyer:
      item.user.companyId === context.companyId
        ? `${item.user.firstName ?? ""} ${item.user.lastName ?? ""}`.trim() || "Unknown"
        : "Unknown",
    status: item.status,
    notes: item.notes,
    rejectionReason: item.rejectionReason,
    requiredActions: item.requiredActions,
    reviewedAt: item.reviewedAt?.toISOString() ?? null,
    documentType: item.document.documentType,
    identityDocumentType: metadata?.identityDocumentType ?? null,
    country: metadata?.country ?? null,
    fileName: item.document.fileName,
    updatedAt: item.updatedAt.toISOString(),
    downloadUrl: `/api/documents/${item.document.id}/download`,
    };
  });
}

export async function reviewKycSubmission(
  context: TenantContext,
  submissionId: string,
  input: AdminKycReviewInput,
) {
  if (!featureFlags.hasDatabase || !context.companyId || !context.userId) {
    return {
      id: submissionId,
      status: input.status,
    };
  }

  const submission = (await findFirstForTenant(
    prisma.kYCSubmission as ScopedFindFirstDelegate,
    context,
    {
      where: {
        id: submissionId,
      },
      select: {
        id: true,
        userId: true,
        status: true,
        user: {
          select: {
            email: true,
            firstName: true,
          },
        },
      },
    } as Parameters<typeof prisma.kYCSubmission.findFirst>[0],
  )) as {
    id: string;
    userId: string;
    status: string;
    user: { email: string; firstName: string | null };
  } | null;

  if (!submission) {
    throw new Error("KYC submission not found.");
  }

  const updated = await prisma.kYCSubmission.update({
    where: {
      id: submissionId,
      companyId: context.companyId,
    },
    data: {
      status: input.status,
      notes: input.notes,
      rejectionReason: input.rejectionReason,
      requiredActions: input.requiredActions,
      reviewedAt: new Date(),
      reviewedById: context.userId,
      reviewedByUserId: context.userId,
    },
    select: {
      id: true,
      status: true,
      userId: true,
    },
  });

  await prisma.notification.create({
    data: {
      companyId: context.companyId,
      userId: updated.userId,
      type: "DOCUMENT_REQUESTED",
      channel: "IN_APP",
      title: "KYC review updated",
      body: `Your KYC document status is now ${input.status.toLowerCase().replaceAll("_", " ")}.`,
      metadata: {
        submissionId,
      } as Prisma.InputJsonValue,
    },
  });

  const company = await prisma.company.findUnique({
    where: { id: context.companyId },
    select: { name: true },
  });

  const { subject, html } = renderKycStatusEmail({
    buyerName: submission.user.firstName ?? "there",
    status: input.status,
    notes: input.notes,
    companyName: company?.name ?? "EstateOS",
  });
  await sendTransactionalEmail({ to: submission.user.email, subject, html });

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId,
    action: input.status === "APPROVED" ? "APPROVE" : input.status === "REJECTED" ? "REJECT" : "UPDATE",
    entityType: "KYCSubmission",
    entityId: submissionId,
    summary: `Updated KYC submission ${submissionId} to ${input.status}`,
    payload: {
      previousStatus: submission.status,
      nextStatus: input.status,
      notes: input.notes,
      rejectionReason: input.rejectionReason,
      requiredActions: input.requiredActions,
    } as Prisma.InputJsonValue,
  });

  return updated;
}
