import { z } from "zod";

export const paymentInitializeSchema = z.object({
  email: z.email(),
  amount: z.number().positive(),
  reference: z.string().min(4),
  callbackUrl: z.string().url(),
  transactionId: z.string().optional(),
  installmentId: z.string().optional(),
  reservationReference: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const paymentVerifySchema = z.object({
  reference: z.string().min(4),
});
