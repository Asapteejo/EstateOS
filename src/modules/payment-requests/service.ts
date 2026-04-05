import { Prisma, type PaymentProviderCode, type PrismaClient, type Prisma as PrismaNamespace } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import { prisma } from "@/lib/db/prisma";
import { env, featureFlags } from "@/lib/env";
import { createInAppNotification, getTenantOperatorRecipients, notifyManyUsers } from "@/lib/notifications/service";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { initializePayment } from "@/lib/payments/paystack";
import { namespacePaymentReference } from "@/lib/payments/references";
import type { TenantContext } from "@/lib/tenancy/context";
import { rejectUnsafeCompanyIdInput } from "@/lib/tenancy/db";
import type { PaymentRequestCreateInput } from "@/types/payment-requests";

type DbClient = PrismaNamespace.TransactionClient | PrismaClient;

function buildPaymentRequestReference(input: { transactionId?: string | null; reservationId?: string | null }) {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
  return `REQ-${input.transactionId ?? input.reservationId ?? "PAY"}-${suffix}`;
}

export function buildReservationPlaceholderReference(reservationReference: string) {
  return `placeholder-${reservationReference}`.toLowerCase();
}

export async function ensureReservationPaymentPlaceholder(
  tx: PrismaNamespace.TransactionClient,
  input: {
    companyId: string;
    userId: string;
    transactionId: string;
    reservationId: string;
    reservationReference: string;
    amount: number;
    currency?: string;
    installmentId?: string | null;
    marketerId?: string | null;
  },
) {
  const providerReference = buildReservationPlaceholderReference(input.reservationReference);
  const existing = await tx.payment.findUnique({
    where: {
      companyId_providerReference: {
        companyId: input.companyId,
        providerReference,
      },
    },
    select: {
      id: true,
      providerReference: true,
      status: true,
    },
  });

  if (existing) {
    return existing;
  }

  return tx.payment.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      transactionId: input.transactionId,
      installmentId: input.installmentId ?? null,
      marketerId: input.marketerId ?? null,
      provider: "PAYSTACK",
      providerReference,
      amount: input.amount,
      currency: input.currency ?? "NGN",
      status: "AWAITING_INITIATION",
      method: "PAYSTACK",
      metadata: {
        placeholder: true,
        reservationId: input.reservationId,
        reservationReference: input.reservationReference,
      } as Prisma.InputJsonValue,
    },
    select: {
      id: true,
      providerReference: true,
      status: true,
    },
  });
}

async function resolvePaymentRequestScope(
  context: TenantContext,
  input: PaymentRequestCreateInput,
) {
  const reservation = input.reservationId
    ? await prisma.reservation.findFirst({
        where: {
          id: input.reservationId,
          companyId: context.companyId!,
        },
        select: {
          id: true,
          reference: true,
          userId: true,
          marketerId: true,
          transaction: {
            select: {
              id: true,
              property: {
                select: {
                  title: true,
                },
              },
            },
          },
        },
      })
    : null;

  const transactionId = input.transactionId ?? reservation?.transaction?.id ?? null;

  const transaction = transactionId
    ? await prisma.transaction.findFirst({
        where: {
          id: transactionId,
          companyId: context.companyId!,
        },
        select: {
          id: true,
          userId: true,
          marketerId: true,
          reservation: {
            select: {
              reference: true,
            },
          },
          property: {
            select: {
              title: true,
            },
          },
        },
      })
    : null;

  const userId = input.userId ?? reservation?.userId ?? transaction?.userId ?? null;
  if (!userId) {
    throw new Error("Payment requests must be linked to a valid client.");
  }

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      companyId: context.companyId!,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!user) {
    throw new Error("Client not found for this tenant.");
  }

  const installment = input.installmentId
    ? await prisma.installment.findFirst({
        where: {
          id: input.installmentId,
          companyId: context.companyId!,
        },
        select: {
          id: true,
        },
      })
    : null;

  if (input.installmentId && !installment) {
    throw new Error("Installment could not be resolved for this tenant.");
  }

  return {
    reservation,
    transaction,
    installment,
    user,
    propertyTitle:
      transaction?.property.title ?? reservation?.transaction?.property.title ?? "Property payment",
  };
}

async function resolveTransactionProvider(companyId: string): Promise<PaymentProviderCode> {
  const settings = await prisma.companyBillingSettings.findUnique({
    where: { companyId },
    select: { transactionProvider: true },
  });

  return settings?.transactionProvider ?? "PAYSTACK";
}

export async function createPaymentRequestForAdmin(
  context: TenantContext,
  rawInput: PaymentRequestCreateInput & Record<string, unknown>,
) {
  rejectUnsafeCompanyIdInput(rawInput);

  if (!context.companyId) {
    throw new Error("Tenant context is required.");
  }

  if (!featureFlags.hasDatabase) {
    return {
      id: "demo-payment-request",
      status: "SENT",
      collectionMethod: rawInput.collectionMethod,
      checkoutUrl: "#",
      transferInstructions: null,
    };
  }

  const scoped = await resolvePaymentRequestScope(context, rawInput);
  const provider = await resolveTransactionProvider(context.companyId);
  const reference = buildPaymentRequestReference({
    transactionId: scoped.transaction?.id,
    reservationId: scoped.reservation?.id,
  });
  const namespacedReference = namespacePaymentReference(context, reference);
  const dueAt = rawInput.dueAt ? new Date(rawInput.dueAt) : null;
  const shouldAttemptPaystack =
    provider === "PAYSTACK" &&
    (rawInput.collectionMethod === "HOSTED_CHECKOUT" ||
      rawInput.collectionMethod === "CARD_LINK" ||
      rawInput.collectionMethod === "BANK_TRANSFER_TEMP_ACCOUNT");

  if (rawInput.collectionMethod === "BANK_TRANSFER_TEMP_ACCOUNT" && provider !== "PAYSTACK") {
    throw new Error("Temporary transfer account requests are currently supported only through Paystack.");
  }

  if (rawInput.collectionMethod === "BANK_TRANSFER_TEMP_ACCOUNT" && !featureFlags.hasPaystack) {
    throw new Error("Paystack transfer-account payment requests are unavailable until live Paystack credentials are configured.");
  }

  const company = await prisma.company.findUnique({
    where: { id: context.companyId },
    select: { name: true, slug: true },
  });

  const initialized = shouldAttemptPaystack
    ? await initializePayment({
        email: scoped.user.email ?? `client+${scoped.user.id}@example.com`,
        amount: rawInput.amount,
        currency: rawInput.currency,
        reference: namespacedReference,
        callbackUrl: `${env.PORTAL_BASE_URL}/portal/payments`,
        channels:
          rawInput.collectionMethod === "BANK_TRANSFER_TEMP_ACCOUNT"
            ? ["bank_transfer"]
            : rawInput.collectionMethod === "CARD_LINK"
              ? ["card"]
              : undefined,
        metadata: {
          paymentRequest: true,
          companyId: context.companyId,
          userId: scoped.user.id,
          transactionId: scoped.transaction?.id,
          reservationReference: scoped.reservation?.reference ?? scoped.transaction?.reservation?.reference,
          installmentId: scoped.installment?.id,
        },
      })
    : null;

  const paymentRequest = await prisma.paymentRequest.create({
    data: {
      companyId: context.companyId,
      userId: scoped.user.id,
      reservationId: scoped.reservation?.id ?? null,
      transactionId: scoped.transaction?.id ?? null,
      installmentId: scoped.installment?.id ?? null,
      provider,
      channel: rawInput.channel,
      collectionMethod: rawInput.collectionMethod,
      status: initialized ? "AWAITING_PAYMENT" : "SENT",
      title: rawInput.title,
      purpose: rawInput.purpose,
      amount: rawInput.amount,
      currency: rawInput.currency,
      dueAt,
      sentAt: new Date(),
      expiresAt:
        initialized?.transferInstructions?.expiresAt != null
          ? new Date(initialized.transferInstructions.expiresAt)
          : dueAt,
      notes: rawInput.notes?.trim() || null,
      providerReference: initialized?.reference ?? null,
      checkoutUrl: initialized?.authorizationUrl ?? null,
      transferBankName: initialized?.transferInstructions?.bankName ?? null,
      transferAccountNumber: initialized?.transferInstructions?.accountNumber ?? null,
      transferAccountName: initialized?.transferInstructions?.accountName ?? null,
      providerPayload: initialized?.providerPayload as Prisma.InputJsonValue | undefined,
    },
    select: {
      id: true,
      status: true,
      collectionMethod: true,
      checkoutUrl: true,
      transferBankName: true,
      transferAccountNumber: true,
      transferAccountName: true,
      providerReference: true,
      dueAt: true,
      expiresAt: true,
    },
  });

  await createInAppNotification({
    companyId: context.companyId,
    userId: scoped.user.id,
    type: "PAYMENT_REQUEST_SENT",
    title: "Payment request created",
    body: `${company?.name ?? "Your company"} sent a payment request for ${rawInput.title}.`,
    metadata: {
      paymentRequestId: paymentRequest.id,
      href: "/portal/payments",
    } as Prisma.InputJsonValue,
  });

  if (scoped.user.email) {
    await sendTransactionalEmail({
      to: scoped.user.email,
      subject: `${company?.name ?? "EstateOS"} payment request`,
      html: `<p>Hi ${scoped.user.firstName ?? "there"},</p>
      <p>${company?.name ?? "Your company"} created a payment request for <strong>${rawInput.title}</strong>.</p>
      <p>Amount due: <strong>${rawInput.currency} ${rawInput.amount.toLocaleString()}</strong></p>
      <p>Reference: <strong>${paymentRequest.providerReference ?? paymentRequest.id}</strong></p>
      ${dueAt ? `<p>Due date: <strong>${dueAt.toDateString()}</strong></p>` : ""}
      ${
        paymentRequest.transferAccountNumber
          ? `<p>Transfer to <strong>${paymentRequest.transferBankName ?? "the provided bank"}</strong> / <strong>${paymentRequest.transferAccountNumber}</strong> (${paymentRequest.transferAccountName ?? "EstateOS Client Account"})</p>`
          : paymentRequest.checkoutUrl
            ? `<p><a href="${paymentRequest.checkoutUrl}">Open secure payment link</a></p>`
            : ""
      }`,
    });
  }

  const operators = await getTenantOperatorRecipients(context.companyId);
  await notifyManyUsers(operators, {
    companyId: context.companyId,
    type: "PAYMENT_REQUEST_SENT",
    title: "Payment request sent",
    body: `${scoped.user.firstName ?? "A client"} now has a payment request for ${scoped.propertyTitle}.`,
    metadata: {
      paymentRequestId: paymentRequest.id,
      href: "/admin/payments",
    } as Prisma.InputJsonValue,
  });

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId ?? undefined,
    action: "PAYMENT",
    entityType: "PaymentRequest",
    entityId: paymentRequest.id,
    summary: `Created ${rawInput.collectionMethod.toLowerCase()} payment request`,
    payload: {
      userId: scoped.user.id,
      amount: rawInput.amount,
      currency: rawInput.currency,
      transactionId: scoped.transaction?.id ?? null,
      reservationId: scoped.reservation?.id ?? null,
      provider,
      providerReference: paymentRequest.providerReference,
    } as Prisma.InputJsonValue,
  });

  return paymentRequest;
}

export async function listPaymentRequestsForAdmin(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return [];
  }

  return prisma.paymentRequest.findMany({
    where: {
      companyId: context.companyId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 30,
    select: {
      id: true,
      title: true,
      purpose: true,
      amount: true,
      currency: true,
      status: true,
      collectionMethod: true,
      dueAt: true,
      expiresAt: true,
      checkoutUrl: true,
      transferBankName: true,
      transferAccountNumber: true,
      transferAccountName: true,
      providerReference: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      transaction: {
        select: {
          reservation: {
            select: {
              reference: true,
            },
          },
        },
      },
    },
  });
}

export async function listPaymentRequestsForBuyer(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId || !context.userId) {
    return [];
  }

  return prisma.paymentRequest.findMany({
    where: {
      companyId: context.companyId,
      userId: context.userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      title: true,
      purpose: true,
      amount: true,
      currency: true,
      status: true,
      collectionMethod: true,
      dueAt: true,
      expiresAt: true,
      checkoutUrl: true,
      transferBankName: true,
      transferAccountNumber: true,
      transferAccountName: true,
      providerReference: true,
      notes: true,
    },
  });
}

export async function syncPaymentRequestStatuses(db: DbClient, input?: { companyId?: string | null; now?: Date }) {
  const now = input?.now ?? new Date();
  const expirable = await db.paymentRequest.findMany({
    where: {
      ...(input?.companyId ? { companyId: input.companyId } : {}),
      status: {
        in: ["SENT", "AWAITING_PAYMENT"],
      },
      expiresAt: {
        not: null,
        lt: now,
      },
    },
    select: {
      id: true,
      companyId: true,
      userId: true,
      title: true,
    },
  });

  for (const request of expirable) {
    await db.paymentRequest.update({
      where: { id: request.id },
      data: { status: "EXPIRED" },
    });

    await createInAppNotification({
      companyId: request.companyId,
      userId: request.userId,
      type: "PAYMENT_REQUEST_EXPIRED",
      title: "Payment request expired",
      body: `${request.title} expired before payment was received.`,
      metadata: {
        paymentRequestId: request.id,
      } as Prisma.InputJsonValue,
    });

    const operators = await getTenantOperatorRecipients(request.companyId);
    await notifyManyUsers(operators, {
      companyId: request.companyId,
      type: "PAYMENT_REQUEST_EXPIRED",
      title: "Payment request expired",
      body: `${request.title} expired before the client completed payment.`,
      metadata: {
        paymentRequestId: request.id,
        href: "/admin/payments",
      } as Prisma.InputJsonValue,
    });
  }

  return { expired: expirable.length };
}

export async function reconcilePaymentRequestFromPayment(input: {
  companyId: string;
  paymentId: string;
  providerReference: string;
  metadata?: Record<string, unknown> | null | undefined;
  status: "SUCCESS" | "FAILED" | "PENDING" | "PROCESSING" | "AWAITING_INITIATION" | "EXPIRED" | "REFUNDED" | "OVERDUE";
}) {
  if (!featureFlags.hasDatabase) {
    return null;
  }

  const paymentRequest = await prisma.paymentRequest.findFirst({
    where: {
      companyId: input.companyId,
      OR: [
        { providerReference: input.providerReference },
        {
          providerReference:
            typeof input.metadata?.paymentRequestReference === "string"
              ? input.metadata.paymentRequestReference
              : undefined,
        },
      ],
    },
    select: {
      id: true,
      userId: true,
      companyId: true,
      title: true,
    },
  });

  if (!paymentRequest) {
    return null;
  }

  const nextStatus = input.status === "SUCCESS" ? "PAID" : input.status === "EXPIRED" ? "EXPIRED" : "AWAITING_PAYMENT";
  const updated = await prisma.paymentRequest.update({
    where: {
      id: paymentRequest.id,
    },
    data: {
      status: nextStatus,
      paidAt: input.status === "SUCCESS" ? new Date() : null,
    },
    select: {
      id: true,
      status: true,
    },
  });

  await prisma.payment.update({
    where: { id: input.paymentId },
    data: {
      paymentRequestId: paymentRequest.id,
    },
  });

  if (input.status === "SUCCESS") {
    await createInAppNotification({
      companyId: paymentRequest.companyId,
      userId: paymentRequest.userId,
      type: "PAYMENT_REQUEST_PAID",
      title: "Payment received",
      body: `${paymentRequest.title} has been paid successfully.`,
      metadata: {
        paymentRequestId: paymentRequest.id,
      } as Prisma.InputJsonValue,
    });

    const operators = await getTenantOperatorRecipients(paymentRequest.companyId);
    await notifyManyUsers(operators, {
      companyId: paymentRequest.companyId,
      type: "PAYMENT_REQUEST_PAID",
      title: "Payment request paid",
      body: `${paymentRequest.title} has been paid successfully.`,
      metadata: {
        paymentRequestId: paymentRequest.id,
        href: "/admin/payments",
      } as Prisma.InputJsonValue,
    });
  }

  return updated;
}
