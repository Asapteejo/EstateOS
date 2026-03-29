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
