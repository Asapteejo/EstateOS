import { z } from "zod";

export const paymentAccountSchema = z.object({
  businessName: z.string().min(2, "Business name must be at least 2 characters"),
  settlementBank: z.string().min(1, "Select a settlement bank"),
  accountNumber: z
    .string()
    .regex(/^\d{10}$/, "Account number must be exactly 10 digits"),
  percentageCharge: z.number().min(0).max(100),
});

export type PaymentAccountInput = z.infer<typeof paymentAccountSchema>;
