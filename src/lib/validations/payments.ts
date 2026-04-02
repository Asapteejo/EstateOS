import { z } from "zod";

export const paymentInitializeSchema = z.object({
  email: z.email(),
  amount: z.number().positive(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).default("NGN"),
  reference: z.string().min(4),
  callbackUrl: z.string().url(),
  transactionId: z.string().optional(),
  installmentId: z.string().optional(),
  reservationReference: z.string().optional(),
  marketerId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).superRefine((value, ctx) => {
  if (value.installmentId && !value.transactionId && !value.reservationReference) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Installment payments must reference a transaction or reservation.",
      path: ["installmentId"],
    });
  }
});

export const paymentVerifySchema = z.object({
  reference: z.string().min(4),
});

export const paymentRequestCreateSchema = z.object({
  userId: z.string().min(1),
  reservationId: z.string().optional(),
  transactionId: z.string().optional(),
  installmentId: z.string().optional(),
  amount: z.number().positive(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).default("NGN"),
  title: z.string().trim().min(2).max(120),
  purpose: z.string().trim().min(2).max(160),
  dueAt: z.string().datetime().optional(),
  notes: z.string().trim().max(500).optional(),
  collectionMethod: z.enum([
    "HOSTED_CHECKOUT",
    "BANK_TRANSFER_TEMP_ACCOUNT",
    "DEDICATED_VIRTUAL_ACCOUNT",
    "MANUAL_BANK_TRANSFER_REFERENCE",
    "CARD_LINK",
  ]).default("HOSTED_CHECKOUT"),
  channel: z.enum(["IN_APP", "EMAIL", "SHARE_LINK"]).default("IN_APP"),
}).superRefine((value, ctx) => {
  if (!value.transactionId && !value.reservationId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Payment requests must be linked to a reservation or transaction.",
      path: ["transactionId"],
    });
  }
});

export const paymentRequestStatusUpdateSchema = z.object({
  status: z.enum(["CANCELLED", "EXPIRED"]),
});
