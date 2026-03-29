import type { PaymentStatus, Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import {
  createReceiptFromPayment,
  type PaymentInitializationInput,
} from "@/lib/payments/paystack";
import {
  assertInstallmentMatchesCompany,
  assertInstallmentMatchesTransaction,
  buildPaystackWebhookEventId,
} from "@/lib/payments/semantics";
import {
  parseTenantPaymentReference,
} from "@/lib/payments/references";

type PaystackWebhookPayload = {
  event: string;
  data?: {
    id?: string | number;
    reference?: string;
    amount?: number;
    paid_at?: string;
    status?: string;
    metadata?: Record<string, unknown>;
    customer?: {
      email?: string;
    };
  };
};

function normalizePaystackStatus(status?: string): PaymentStatus {
  return status === "success" ? "SUCCESS" : "FAILED";
}

async function resolveCompanyFromReference(reference: string) {
  const parsed = parseTenantPaymentReference(reference);
  if (!parsed) {
    return null;
  }

  if (!featureFlags.hasDatabase) {
    if (parsed.tenantSegment === "acme-realty") {
      return {
        id: "demo-company-acme",
        slug: "acme-realty",
      };
    }

    return null;
  }

  return prisma.company.findFirst({
    where: {
      OR: [
        { slug: parsed.tenantSegment },
        { subdomain: parsed.tenantSegment },
      ],
    },
    select: {
      id: true,
      slug: true,
    },
  });
}

export async function persistInitializedPayment(
  input: PaymentInitializationInput & {
    companyId: string;
    userId: string;
    transactionId?: string;
    installmentId?: string;
    reservationReference?: string;
  },
) {
  if (!featureFlags.hasDatabase) {
    return null;
  }

  let transactionId = input.transactionId;
  let installmentId = input.installmentId;

  if (!transactionId && input.reservationReference) {
    const reservation = await prisma.reservation.findFirst({
      where: {
        companyId: input.companyId,
        reference: input.reservationReference,
        userId: input.userId,
      },
      select: {
        transaction: {
          select: {
            id: true,
          },
        },
      },
    });

    transactionId = reservation?.transaction?.id;
  }

  if (installmentId) {
    const installment = await prisma.installment.findFirst({
      where: {
        companyId: input.companyId,
        id: installmentId,
      },
      select: {
        id: true,
        companyId: true,
      },
    });

    if (installment) {
      assertInstallmentMatchesCompany(input.companyId, installment.companyId);
    }

    installmentId = installment?.id;
  }

  return prisma.payment.upsert({
    where: {
      companyId_providerReference: {
        companyId: input.companyId,
        providerReference: input.reference,
      },
    },
    update: {
      transactionId,
      installmentId,
      userId: input.userId,
      amount: input.amount,
      status: "PENDING",
      method: "PAYSTACK",
      metadata: {
        ...(input.metadata ?? {}),
        transactionId,
        installmentId,
        reservationReference: input.reservationReference,
      } as Prisma.InputJsonValue,
    },
    create: {
      companyId: input.companyId,
      transactionId,
      installmentId,
      userId: input.userId,
      providerReference: input.reference,
      amount: input.amount,
      status: "PENDING",
      method: "PAYSTACK",
      metadata: {
        ...(input.metadata ?? {}),
        transactionId,
        installmentId,
        reservationReference: input.reservationReference,
      } as Prisma.InputJsonValue,
    },
  });
}

export async function reconcilePaystackWebhook(rawPayload: PaystackWebhookPayload) {
  const reference = rawPayload.data?.reference;
  if (!reference) {
    throw new Error("Webhook payload is missing payment reference.");
  }

  const company = await resolveCompanyFromReference(reference);
  if (!company) {
    throw new Error("Unable to resolve tenant from payment reference.");
  }

  const providerEventId = buildPaystackWebhookEventId({
    event: rawPayload.event,
    providerId: rawPayload.data?.id,
    reference,
  });

  const existingWebhook = featureFlags.hasDatabase
    ? await prisma.webhookEvent.findFirst({
        where: {
          companyId: company.id,
          provider: "PAYSTACK",
          providerEventId,
        },
        select: {
          id: true,
        },
      })
    : null;

  if (existingWebhook) {
    return {
      duplicate: true,
      companyId: company.id,
      providerEventId,
    };
  }

  const status = normalizePaystackStatus(rawPayload.data?.status);
  const transactionIdFromMetadata =
    typeof rawPayload.data?.metadata?.transactionId === "string"
      ? rawPayload.data.metadata.transactionId
      : undefined;
  const reservationReferenceFromMetadata =
    typeof rawPayload.data?.metadata?.reservationReference === "string"
      ? rawPayload.data.metadata.reservationReference
      : undefined;
  const installmentIdFromMetadata =
    typeof rawPayload.data?.metadata?.installmentId === "string"
      ? rawPayload.data.metadata.installmentId
      : undefined;

  let payment =
    featureFlags.hasDatabase
      ? await prisma.payment.findUnique({
          where: {
            companyId_providerReference: {
              companyId: company.id,
              providerReference: reference,
            },
          },
        })
      : null;

  let resolvedTransactionId =
    payment?.transactionId ?? transactionIdFromMetadata ?? undefined;
  let resolvedInstallmentId =
    payment?.installmentId ?? installmentIdFromMetadata ?? undefined;

  if (!resolvedTransactionId && reservationReferenceFromMetadata && featureFlags.hasDatabase) {
    const reservation = await prisma.reservation.findFirst({
      where: {
        companyId: company.id,
        reference: reservationReferenceFromMetadata,
      },
      select: {
        transaction: {
          select: {
            id: true,
          },
        },
      },
    });

    resolvedTransactionId = reservation?.transaction?.id;
  }

  if (resolvedInstallmentId && featureFlags.hasDatabase) {
    const installment = await prisma.installment.findFirst({
      where: {
        companyId: company.id,
        id: resolvedInstallmentId,
      },
      select: {
        id: true,
        companyId: true,
        paymentPlan: {
          select: {
            propertyId: true,
          },
        },
      },
    });

    if (!installment) {
      resolvedInstallmentId = undefined;
    } else if (resolvedTransactionId) {
      assertInstallmentMatchesCompany(company.id, installment.companyId);

      const transaction = await prisma.transaction.findFirst({
        where: {
          companyId: company.id,
          id: resolvedTransactionId,
        },
        select: {
          propertyId: true,
        },
      });

      try {
        assertInstallmentMatchesTransaction(
          transaction?.propertyId,
          installment.paymentPlan.propertyId,
        );
      } catch {
        resolvedInstallmentId = undefined;
      }
    }
  }

  if (featureFlags.hasDatabase && !payment) {
    payment = await prisma.payment.create({
      data: {
        companyId: company.id,
        transactionId: resolvedTransactionId,
        installmentId: resolvedInstallmentId,
        providerReference: reference,
        amount: (rawPayload.data?.amount ?? 0) / 100,
        status,
        method: "PAYSTACK",
        paidAt: rawPayload.data?.paid_at ? new Date(rawPayload.data.paid_at) : null,
        metadata: rawPayload as unknown as Prisma.InputJsonValue,
      },
    });
  } else if (featureFlags.hasDatabase && payment) {
    payment = await prisma.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        transactionId: resolvedTransactionId ?? payment.transactionId,
        installmentId: resolvedInstallmentId ?? payment.installmentId,
        status,
        paidAt: rawPayload.data?.paid_at ? new Date(rawPayload.data.paid_at) : payment.paidAt,
        metadata: rawPayload as unknown as Prisma.InputJsonValue,
      },
    });
  }

  let receipt = null;

  if (featureFlags.hasDatabase && payment) {
    const generatedReceipt = createReceiptFromPayment(
      reference,
      payment.amount.toNumber(),
    );

    receipt = await prisma.receipt.upsert({
      where: {
        paymentId: payment.id,
      },
      update: {
        companyId: company.id,
        transactionId: payment.transactionId,
        receiptNumber: generatedReceipt.receiptNumber,
        totalAmount: payment.amount,
      },
      create: {
        companyId: company.id,
        paymentId: payment.id,
        transactionId: payment.transactionId,
        receiptNumber: generatedReceipt.receiptNumber,
        totalAmount: payment.amount,
      },
    });

    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        companyId: company.id,
        provider: "PAYSTACK",
        eventType: rawPayload.event,
        providerEventId,
        paymentId: payment.id,
        signatureVerified: true,
        payload: rawPayload as unknown as Prisma.InputJsonValue,
      },
    });

    await writeAuditLog({
      companyId: company.id,
      action: "PAYMENT",
      entityType: "Payment",
      entityId: payment.id,
      summary: `Webhook reconciled payment ${reference} as ${status}`,
      payload: {
        providerEventId,
        webhookEventId: webhookEvent.id,
        receiptId: receipt.id,
      } as Prisma.InputJsonValue,
    });
  }

  return {
    duplicate: false,
    companyId: company.id,
    providerEventId,
    paymentId: payment?.id ?? null,
    receiptId: receipt?.id ?? null,
    status,
  };
}
