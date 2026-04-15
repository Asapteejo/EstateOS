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
import { deriveOverallKycStatus } from "@/modules/transactions/workflow";
import { syncTransactionMilestones } from "@/modules/transactions/mutations";

type ScopedFindFirstDelegate = { findFirst: (args?: unknown) => Promise<unknown> };
type ScopedFindManyDelegate = { findMany: (args?: unknown) => Promise<unknown> };

export type BuyerProfileRecord = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
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
  fileName: string;
  status: string;
  notes: string | null;
  createdAt: string;
  downloadUrl: string;
};

export async function getBuyerProfileRecord(context: TenantContext): Promise<BuyerProfileRecord | null> {
  if (!featureFlags.hasDatabase || !context.companyId || !context.userId) {
    return {
      firstName: "Ada",
      lastName: "Okafor",
      email: "buyer@acmerealty.dev",
      phone: "+2348010001111",
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

  const user = (await findFirstForTenant(
    prisma.user as ScopedFindFirstDelegate,
    context,
    {
      where: {
        id: context.userId,
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

  if (!user) {
    return null;
  }

  return {
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    email: user.email,
    phone: user.phone ?? "",
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
    dateOfBirth?: string;
    nationality: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    country: string;
    occupation: string;
    nextOfKinName: string;
    nextOfKinPhone: string;
  },
) {
  rejectUnsafeCompanyIdInput(input);

  if (!featureFlags.hasDatabase || !context.companyId || !context.userId) {
    return {
      profileCompleted: true,
    };
  }

  const updated = await prisma.user.update({
    where: {
      id: context.userId,
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
            nationality: input.nationality,
            addressLine1: input.addressLine1,
            addressLine2: input.addressLine2,
            city: input.city,
            state: input.state,
            country: input.country,
            occupation: input.occupation,
            nextOfKinName: input.nextOfKinName,
            nextOfKinPhone: input.nextOfKinPhone,
            profileCompleted: true,
          },
          create: {
            dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
            nationality: input.nationality,
            addressLine1: input.addressLine1,
            addressLine2: input.addressLine2,
            city: input.city,
            state: input.state,
            country: input.country,
            occupation: input.occupation,
            nextOfKinName: input.nextOfKinName,
            nextOfKinPhone: input.nextOfKinPhone,
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

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId,
    action: "UPDATE",
    entityType: "Profile",
    entityId: context.userId,
    summary: "Buyer profile updated",
  });

  return {
    profileCompleted: updated.profile?.profileCompleted ?? false,
  };
}

export async function getBuyerKycWorkspace(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId || !context.userId) {
    return {
      overallStatus: "NOT_SUBMITTED",
      submissions: [] as BuyerKycSubmissionListItem[],
    };
  }

  const submissions = (await findManyForTenant(
    prisma.kYCSubmission as ScopedFindManyDelegate,
    context,
    {
      where: {
        userId: context.userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        status: true,
        notes: true,
        createdAt: true,
        document: {
          select: {
            id: true,
            fileName: true,
            documentType: true,
            storageKey: true,
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
    createdAt: Date;
    document: {
      id: string;
      fileName: string;
      documentType: string;
      storageKey: string;
      visibility: "PUBLIC" | "PRIVATE";
      companyId: string;
      userId: string | null;
      transaction: { userId: string } | null;
    };
  }>;

  const safeSubmissions: BuyerKycSubmissionListItem[] = [];

  for (const submission of submissions) {
    assertDocumentAccess(context, {
      id: submission.document.id,
      companyId: submission.document.companyId,
      userId: submission.document.userId,
      visibility: submission.document.visibility,
      fileName: submission.document.fileName,
      storageKey: submission.document.storageKey,
      transaction: submission.document.transaction,
    });

    const downloadUrl =
      isTenantStorageKey(context, submission.document.storageKey)
        ? `/api/documents/${submission.document.id}/download`
        : "#";

    safeSubmissions.push({
      id: submission.id,
      documentType: submission.document.documentType,
      fileName: submission.document.fileName,
      status: submission.status,
      notes: submission.notes,
      createdAt: submission.createdAt.toISOString(),
      downloadUrl,
    });
  }

  return {
    overallStatus: deriveOverallKycStatus(safeSubmissions.map((item) => item.status)),
    submissions: safeSubmissions,
  };
}

export async function createBuyerKycSubmission(
  context: TenantContext,
  input: BuyerKycSubmissionInput & Record<string, unknown>,
) {
  rejectUnsafeCompanyIdInput(input);

  if (!context.companyId || !context.userId) {
    throw new Error("Authentication and tenant context are required.");
  }

  if (!isTenantStorageKey(context, input.storageKey)) {
    throw new Error("KYC document storage namespace mismatch.");
  }

  if (!featureFlags.hasDatabase) {
    return {
      status: "SUBMITTED",
    };
  }

  const created = await prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        companyId: context.companyId!,
        userId: context.userId!,
        fileName: input.fileName,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        documentType: input.documentType,
        visibility: "PRIVATE",
        uploadedByUserId: context.userId!,
        createdForUserId: context.userId!,
        metadata: {
          notes: input.notes,
        } as Prisma.InputJsonValue,
      },
      select: {
        id: true,
      },
    });

    const submission = await tx.kYCSubmission.create({
      data: {
        companyId: context.companyId!,
        userId: context.userId!,
        documentId: document.id,
        status: "SUBMITTED",
        notes: input.notes,
      },
      select: {
        id: true,
        status: true,
      },
    });

    const transaction = await tx.transaction.findFirst({
      where: {
        companyId: context.companyId!,
        userId: context.userId!,
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
    actorUserId: context.userId,
    action: "CREATE",
    entityType: "KYCSubmission",
    entityId: created.id,
    summary: `Submitted ${input.documentType} for KYC review`,
    payload: {
      documentType: input.documentType,
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
      storageKey: string;
      companyId: string;
    };
  }>;

  return queue.map((item) => ({
    id: item.id,
    buyer:
      item.user.companyId === context.companyId
        ? `${item.user.firstName ?? ""} ${item.user.lastName ?? ""}`.trim() || "Unknown"
        : "Unknown",
    status: item.status,
    notes: item.notes,
    documentType: item.document.documentType,
    fileName: item.document.fileName,
    updatedAt: item.updatedAt.toISOString(),
    downloadUrl: `/api/documents/${item.document.id}/download`,
  }));
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
    },
    data: {
      status: input.status,
      notes: input.notes,
      reviewedById: context.userId,
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
    } as Prisma.InputJsonValue,
  });

  return updated;
}
