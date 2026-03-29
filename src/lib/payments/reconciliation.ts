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
import {
  calculateOutstandingBalance,
  deriveTransactionStageFromPayment,
} from "@/modules/transactions/workflow";
import { syncTransactionMilestones } from "@/modules/transactions/mutations";
import { buildSettlementQuote, getCompanyPlanStatus, recordBillingEvent } from "@/modules/billing/service";

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
    marketerId?: string;
  },
) {
  if (!featureFlags.hasDatabase) {
    return null;
  }

  let transactionId = input.transactionId;
  let installmentId = input.installmentId;
  let marketerId = input.marketerId;

  if (transactionId) {
    const transaction = await prisma.transaction.findFirst({
      where: {
        companyId: input.companyId,
        id: transactionId,
        userId: input.userId,
      },
      select: {
        id: true,
        propertyId: true,
        marketerId: true,
      },
    });

    transactionId = transaction?.id;
    marketerId = marketerId ?? transaction?.marketerId ?? undefined;
  }

  if (!transactionId && input.reservationReference) {
    const reservation = await prisma.reservation.findFirst({
      where: {
        companyId: input.companyId,
        reference: input.reservationReference,
        userId: input.userId,
      },
      select: {
        marketerId: true,
        transaction: {
          select: {
            id: true,
            marketerId: true,
          },
        },
      },
    });

    transactionId = reservation?.transaction?.id;
    marketerId =
      marketerId ?? reservation?.transaction?.marketerId ?? reservation?.marketerId ?? undefined;
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
        paymentPlan: {
          select: {
            propertyId: true,
          },
        },
      },
    });

    if (installment) {
      assertInstallmentMatchesCompany(input.companyId, installment.companyId);
      if (transactionId) {
        const transaction = await prisma.transaction.findFirst({
          where: {
            companyId: input.companyId,
            id: transactionId,
            userId: input.userId,
          },
          select: {
            propertyId: true,
          },
        });

        assertInstallmentMatchesTransaction(
          transaction?.propertyId,
          installment.paymentPlan.propertyId,
        );
      }
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
      marketerId,
      amount: input.amount,
      currency: input.currency ?? "NGN",
      status: "PENDING",
      method: "PAYSTACK",
      metadata: {
        ...(input.metadata ?? {}),
        transactionId,
        installmentId,
        reservationReference: input.reservationReference,
        marketerId,
      } as Prisma.InputJsonValue,
    },
    create: {
      companyId: input.companyId,
      transactionId,
      installmentId,
      userId: input.userId,
      marketerId,
      providerReference: input.reference,
      amount: input.amount,
      currency: input.currency ?? "NGN",
      status: "PENDING",
      method: "PAYSTACK",
      metadata: {
        ...(input.metadata ?? {}),
        transactionId,
        installmentId,
        reservationReference: input.reservationReference,
        marketerId,
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
  let resolvedMarketerId =
    payment?.marketerId ??
    (typeof rawPayload.data?.metadata?.marketerId === "string"
      ? rawPayload.data.metadata.marketerId
      : undefined);

  if (!resolvedTransactionId && reservationReferenceFromMetadata && featureFlags.hasDatabase) {
    const reservation = await prisma.reservation.findFirst({
      where: {
        companyId: company.id,
        reference: reservationReferenceFromMetadata,
      },
      select: {
        marketerId: true,
        transaction: {
          select: {
            id: true,
            marketerId: true,
          },
        },
      },
    });

    resolvedTransactionId = reservation?.transaction?.id;
    resolvedMarketerId =
      resolvedMarketerId ?? reservation?.transaction?.marketerId ?? reservation?.marketerId ?? undefined;
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
        marketerId: resolvedMarketerId,
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
        marketerId: resolvedMarketerId ?? payment.marketerId,
        status,
        paidAt: rawPayload.data?.paid_at ? new Date(rawPayload.data.paid_at) : payment.paidAt,
        metadata: rawPayload as unknown as Prisma.InputJsonValue,
      },
    });
  }

  let receipt = null;
  let receiptDocumentId: string | null = null;

  if (featureFlags.hasDatabase && payment) {
    const generatedReceipt = createReceiptFromPayment(
      reference,
      payment.amount.toNumber(),
      payment.currency,
    );
    const billingQuote = await buildSettlementQuote({
      companyId: company.id,
      amount: payment.amount.toNumber(),
      currency: payment.currency,
    });
    const companyPlanStatus = await getCompanyPlanStatus({ companyId: company.id });

    const transactionUpdate = await prisma.$transaction(async (tx) => {
      let updatedTransactionId = payment.transactionId;
      let updatedTransactionStage: string | null = null;

      if (status === "SUCCESS" && payment.transactionId) {
        const transaction = await tx.transaction.findFirst({
          where: {
            companyId: company.id,
            id: payment.transactionId,
          },
          select: {
            id: true,
            currentStage: true,
            outstandingBalance: true,
            userId: true,
            reservation: {
              select: {
                id: true,
              },
            },
          },
        });

        if (transaction) {
          const nextOutstandingBalance = calculateOutstandingBalance(
            transaction.outstandingBalance.toNumber(),
            payment.amount.toNumber(),
          );
          const nextStage = deriveTransactionStageFromPayment({
            currentStage: transaction.currentStage,
            outstandingBalanceBefore: transaction.outstandingBalance.toNumber(),
            paymentAmount: payment.amount.toNumber(),
          });

          const updatedTransaction = await tx.transaction.update({
            where: {
              id: transaction.id,
            },
            data: {
              outstandingBalance: nextOutstandingBalance,
              currentStage: nextStage,
            },
            select: {
              id: true,
              currentStage: true,
              userId: true,
              reservation: {
                select: {
                  id: true,
                },
              },
            },
          });

          updatedTransactionId = updatedTransaction.id;
          updatedTransactionStage = updatedTransaction.currentStage;

          await syncTransactionMilestones(tx, {
            companyId: company.id,
            transactionId: updatedTransaction.id,
            currentStage: updatedTransaction.currentStage,
          });

          if (updatedTransaction.currentStage === "FINAL_PAYMENT_COMPLETED" && updatedTransaction.reservation) {
            await tx.reservation.update({
              where: {
                id: updatedTransaction.reservation.id,
              },
              data: {
                status: "CONVERTED",
              },
            });
          }

          await tx.notification.create({
            data: {
              companyId: company.id,
              userId: updatedTransaction.userId,
              type: "PAYMENT_CONFIRMED",
              channel: "IN_APP",
              title: "Payment confirmed",
              body: `Payment ${reference} has been reconciled successfully.`,
              metadata: {
                reference,
                transactionId: updatedTransaction.id,
              } as Prisma.InputJsonValue,
            },
          });
        }
      }

      const persistedReceipt = await tx.receipt.upsert({
        where: {
          paymentId: payment.id,
        },
        update: {
          companyId: company.id,
          transactionId: updatedTransactionId,
          receiptNumber: generatedReceipt.receiptNumber,
          totalAmount: payment.amount,
          renderData: {
            providerReference: reference,
            transactionStage: updatedTransactionStage,
          } as Prisma.InputJsonValue,
        },
        create: {
          companyId: company.id,
          paymentId: payment.id,
          transactionId: updatedTransactionId,
          receiptNumber: generatedReceipt.receiptNumber,
          totalAmount: payment.amount,
          renderData: {
            providerReference: reference,
            transactionStage: updatedTransactionStage,
          } as Prisma.InputJsonValue,
        },
      });

      const receiptDocument = await tx.document.upsert({
        where: {
          companyId_storageKey: {
            companyId: company.id,
            storageKey: `${company.slug}/receipts/${generatedReceipt.receiptNumber}.pdf`,
          },
        },
        update: {
          fileName: `${generatedReceipt.receiptNumber}.pdf`,
          transactionId: updatedTransactionId,
          userId: payment.userId,
          documentType: "RECEIPT",
          visibility: "PRIVATE",
          metadata: {
            receiptId: persistedReceipt.id,
            providerReference: reference,
            generatedFromWebhook: true,
            isFullPaymentReceipt: updatedTransactionStage === "FINAL_PAYMENT_COMPLETED",
          } as Prisma.InputJsonValue,
        },
        create: {
          companyId: company.id,
          userId: payment.userId,
          transactionId: updatedTransactionId,
          fileName: `${generatedReceipt.receiptNumber}.pdf`,
          storageKey: `${company.slug}/receipts/${generatedReceipt.receiptNumber}.pdf`,
          documentType: "RECEIPT",
          visibility: "PRIVATE",
          metadata: {
            receiptId: persistedReceipt.id,
            providerReference: reference,
            generatedFromWebhook: true,
            isFullPaymentReceipt: updatedTransactionStage === "FINAL_PAYMENT_COMPLETED",
          } as Prisma.InputJsonValue,
        },
        select: {
          id: true,
        },
      });

      const commissionRecord = await tx.commissionRecord.upsert({
        where: {
          paymentId: payment.id,
        },
        update: {
          companyId: company.id,
          transactionId: updatedTransactionId,
          subscriptionId: companyPlanStatus.subscription?.id ?? null,
          planId: companyPlanStatus.plan?.id ?? null,
          commissionRuleId: billingQuote.commissionRule.id ?? null,
          grossAmount: billingQuote.breakdown.grossAmount,
          companyAmount: billingQuote.breakdown.companyAmount,
          platformCommission: billingQuote.breakdown.platformCommission,
          providerFee: billingQuote.breakdown.providerFee,
          netAmount: billingQuote.breakdown.netAmount,
          currency: billingQuote.breakdown.currency,
          settlementStatus: billingQuote.settlement.ready ? "READY" : "FAILED",
          metadata: {
            planState: companyPlanStatus.state,
            isGranted: companyPlanStatus.isGranted,
            provider: billingQuote.provider,
          } as Prisma.InputJsonValue,
        },
        create: {
          companyId: company.id,
          paymentId: payment.id,
          transactionId: updatedTransactionId,
          subscriptionId: companyPlanStatus.subscription?.id ?? null,
          planId: companyPlanStatus.plan?.id ?? null,
          commissionRuleId: billingQuote.commissionRule.id ?? null,
          grossAmount: billingQuote.breakdown.grossAmount,
          companyAmount: billingQuote.breakdown.companyAmount,
          platformCommission: billingQuote.breakdown.platformCommission,
          providerFee: billingQuote.breakdown.providerFee,
          netAmount: billingQuote.breakdown.netAmount,
          currency: billingQuote.breakdown.currency,
          settlementStatus: billingQuote.settlement.ready ? "READY" : "FAILED",
          metadata: {
            planState: companyPlanStatus.state,
            isGranted: companyPlanStatus.isGranted,
            provider: billingQuote.provider,
          } as Prisma.InputJsonValue,
        },
      });

      const splitSettlement = await tx.splitSettlement.upsert({
        where: {
          paymentId: payment.id,
        },
        update: {
          companyId: company.id,
          provider: billingQuote.provider,
          providerAccountId: billingQuote.payoutAccount?.id ?? null,
          grossAmount: billingQuote.breakdown.grossAmount,
          companyAmount: billingQuote.breakdown.companyAmount,
          platformAmount: billingQuote.breakdown.platformCommission,
          providerFee: billingQuote.breakdown.providerFee,
          currency: billingQuote.breakdown.currency,
          status: billingQuote.settlement.ready ? "READY" : "FAILED",
          metadata: billingQuote.settlement.providerPayload as Prisma.InputJsonValue | undefined,
        },
        create: {
          companyId: company.id,
          paymentId: payment.id,
          provider: billingQuote.provider,
          providerAccountId: billingQuote.payoutAccount?.id ?? null,
          grossAmount: billingQuote.breakdown.grossAmount,
          companyAmount: billingQuote.breakdown.companyAmount,
          platformAmount: billingQuote.breakdown.platformCommission,
          providerFee: billingQuote.breakdown.providerFee,
          currency: billingQuote.breakdown.currency,
          status: billingQuote.settlement.ready ? "READY" : "FAILED",
          metadata: billingQuote.settlement.providerPayload as Prisma.InputJsonValue | undefined,
        },
      });

      const webhookEvent = await tx.webhookEvent.create({
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

      return {
        receipt: persistedReceipt,
        webhookEventId: webhookEvent.id,
        receiptDocumentId: receiptDocument.id,
        transactionStage: updatedTransactionStage,
        commissionRecordId: commissionRecord.id,
        splitSettlementId: splitSettlement.id,
      };
    });

    receipt = transactionUpdate.receipt;
    receiptDocumentId = transactionUpdate.receiptDocumentId;

    await recordBillingEvent({
      companyId: company.id,
      subscriptionId: companyPlanStatus.subscription?.id,
      type: "SUBSCRIPTION_PAYMENT_RECORDED",
      provider: billingQuote.provider,
      amount: billingQuote.breakdown.platformCommission,
      currency: billingQuote.breakdown.currency,
      status,
      summary: `Captured platform commission for payment ${reference}`,
      metadata: {
        paymentId: payment.id,
        commissionRuleId: billingQuote.commissionRule.id ?? null,
        isGrantedPlan: companyPlanStatus.isGranted,
      } as Prisma.InputJsonValue,
    });

    await writeAuditLog({
      companyId: company.id,
      action: "PAYMENT",
      entityType: "Payment",
      entityId: payment.id,
      summary: `Webhook reconciled payment ${reference} as ${status}`,
      payload: {
        providerEventId,
        receiptId: receipt.id,
        receiptDocumentId,
        transactionStage: transactionUpdate.transactionStage,
        planState: companyPlanStatus.state,
        settlementReady: billingQuote.settlement.ready,
        commissionAmount: billingQuote.breakdown.platformCommission,
      } as Prisma.InputJsonValue,
    });
  }

  return {
    duplicate: false,
    companyId: company.id,
    providerEventId,
    paymentId: payment?.id ?? null,
    receiptId: receipt?.id ?? null,
    receiptDocumentId,
    status,
  };
}
