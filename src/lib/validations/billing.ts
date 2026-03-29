import { z } from "zod";

const billingFeatureFlagsSchema = z
  .object({
    TRANSACTIONS: z.boolean().optional(),
    ADMIN_OPERATIONS: z.boolean().optional(),
    BILLING_OVERVIEW: z.boolean().optional(),
  })
  .optional();

export const billingPlanUpsertSchema = z.object({
  code: z.string().trim().min(2),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(2),
  description: z.string().trim().optional(),
  interval: z.enum(["MONTHLY", "ANNUAL"]),
  priceAmount: z.number().nonnegative(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  isActive: z.boolean().default(true),
  isPublic: z.boolean().default(true),
  canBeGranted: z.boolean().default(true),
  featureFlags: billingFeatureFlagsSchema,
  allowances: z.record(z.string(), z.unknown()).optional(),
});

export const companySubscriptionAssignmentSchema = z
  .object({
    companyId: z.string().min(1),
    planId: z.string().min(1),
    status: z.enum(["ACTIVE", "TRIAL", "GRANTED"]),
    interval: z.enum(["MONTHLY", "ANNUAL"]).optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    reason: z.string().trim().max(400).optional(),
    notes: z.string().trim().max(400).optional(),
    billingProvider: z.enum(["PAYSTACK", "FLUTTERWAVE", "STRIPE", "MANUAL"]).optional(),
    autoRenews: z.boolean().default(false),
    externalSubscriptionId: z.string().trim().optional(),
    externalCustomerId: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === "GRANTED" && !value.reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Manual grants require a reason.",
        path: ["reason"],
      });
    }

    if (value.startsAt && value.endsAt) {
      const startsAt = new Date(value.startsAt);
      const endsAt = new Date(value.endsAt);
      if (startsAt >= endsAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Subscription end date must be after the start date.",
          path: ["endsAt"],
        });
      }
    }
  });

export const companySubscriptionRevocationSchema = z.object({
  status: z.enum(["CANCELLED", "EXPIRED"]).default("CANCELLED"),
  reason: z.string().trim().max(400).optional(),
  notes: z.string().trim().max(400).optional(),
});

export type BillingPlanUpsertInput = z.infer<typeof billingPlanUpsertSchema>;
export type CompanySubscriptionAssignmentInput = z.infer<
  typeof companySubscriptionAssignmentSchema
>;
export type CompanySubscriptionRevocationInput = z.infer<
  typeof companySubscriptionRevocationSchema
>;
