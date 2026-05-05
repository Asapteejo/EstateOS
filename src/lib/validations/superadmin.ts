import { z } from "zod";

const emptyStringToUndefined = <TSchema extends z.ZodTypeAny>(schema: TSchema) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    schema,
  );

const optionalDateInput = emptyStringToUndefined(
  z
    .string()
    .trim()
    .transform((value) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return `${value}T00:00:00.000Z`;
      }

      return value;
    })
    .pipe(z.string().datetime())
    .optional(),
);

export const companyLifecycleUpdateSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "DISABLED"]),
  reason: z.string().trim().max(300).optional().nullable(),
});

export const superadminPlanSelectionSchema = z.enum(["FREE", "PRO", "PREMIUM"]);
export const superadminBillingModeSchema = z.enum(["MANUAL_OVERRIDE", "TRIAL", "PAID"]);
export const superadminAccessStatusSchema = z.enum(["ACTIVE", "SUSPENDED"]);

export const superadminCompanyOnboardingSchema = z
  .object({
    companyName: z.string().trim().min(2, "Company name is required."),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9-]+$/, "Slug may contain lowercase letters, numbers, and hyphens only."),
    contactEmail: z.string().trim().email("A valid company contact email is required."),
    contactPhone: z.string().trim().max(40).optional(),
    ownerFirstName: z.string().trim().min(1, "Owner first name is required."),
    ownerLastName: z.string().trim().min(1, "Owner last name is required."),
    ownerEmail: z.string().trim().email("A valid owner email is required.").transform((value) => value.toLowerCase()),
    plan: superadminPlanSelectionSchema,
    billingMode: superadminBillingModeSchema,
    accessStatus: superadminAccessStatusSchema,
    subscriptionEndsAt: optionalDateInput,
    internalNote: z.string().trim().max(800).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.accessStatus === "SUSPENDED" && !value.internalNote) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A note is required when creating a suspended company.",
        path: ["internalNote"],
      });
    }
  });

export const superadminSubscriptionOverrideSchema = z
  .object({
    companyId: z.string().trim().min(1),
    plan: superadminPlanSelectionSchema,
    billingMode: superadminBillingModeSchema,
    accessStatus: superadminAccessStatusSchema,
    subscriptionEndsAt: optionalDateInput,
    lifetimeInternalTest: z.boolean().default(false),
    internalNote: z.string().trim().max(800).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.billingMode === "MANUAL_OVERRIDE" && !value.internalNote) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Manual overrides require an internal note.",
        path: ["internalNote"],
      });
    }

    if (value.lifetimeInternalTest && value.billingMode === "PAID") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Lifetime internal test access cannot use PAID billing mode.",
        path: ["lifetimeInternalTest"],
      });
    }
  });

export type CompanyLifecycleUpdateInput = z.infer<typeof companyLifecycleUpdateSchema>;
export type SuperadminCompanyOnboardingInput = z.infer<
  typeof superadminCompanyOnboardingSchema
>;
export type SuperadminSubscriptionOverrideInput = z.infer<
  typeof superadminSubscriptionOverrideSchema
>;
export type SuperadminPlanSelection = z.infer<typeof superadminPlanSelectionSchema>;
export type SuperadminBillingMode = z.infer<typeof superadminBillingModeSchema>;
