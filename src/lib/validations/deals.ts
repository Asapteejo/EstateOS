import { z } from "zod";

export const adminDealCreateSchema = z.object({
  buyerName: z.string().trim().min(2).max(120),
  propertyId: z.string().min(1),
  propertyUnitId: z.string().optional(),
  totalValue: z.coerce.number().positive(),
  paymentMode: z.enum(["FULL", "INSTALLMENT"]).default("FULL"),
  paymentPlanId: z.string().optional(),
}).superRefine((value, ctx) => {
  if (value.paymentMode === "INSTALLMENT" && value.paymentPlanId && value.paymentPlanId.trim().length < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid payment plan selection.",
      path: ["paymentPlanId"],
    });
  }
});

export type AdminDealCreateInput = z.infer<typeof adminDealCreateSchema>;

export const adminQuickPropertyCreateSchema = z.object({
  title: z.string().trim().min(3).max(120),
  price: z.coerce.number().positive().optional(),
});

export type AdminQuickPropertyCreateInput = z.infer<typeof adminQuickPropertyCreateSchema>;
