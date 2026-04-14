import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((value) => value || undefined);
const optionalUrl = z
  .string()
  .trim()
  .url()
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((value) => value || undefined);
const optionalColor = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/)
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((value) => value || undefined);

export const tenantSettingsSchema = z.object({
  companyName: z.string().trim().min(2),
  logoUrl: optionalUrl,
  supportEmail: z
    .string()
    .trim()
    .email()
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((value) => value || undefined),
  supportPhone: optionalString,
  whatsappNumber: optionalString,
  address: optionalString,
  primaryColor: optionalColor,
  accentColor: optionalColor,
  defaultWishlistDurationDays: z.coerce.number().int().min(1).max(365).default(14),
  verificationFreshDays: z.coerce.number().int().min(1).max(30).default(7),
  verificationStaleDays: z.coerce.number().int().min(2).max(90).default(30),
  verificationHideDays: z.coerce.number().int().min(3).max(180).default(45),
  verificationWarningReminderDays: z.coerce.number().int().min(1).max(30).default(2),
  defaultCurrency: z.string().trim().min(3).max(3).default("NGN"),
  paymentDisplayLabel: optionalString,
  receiptFooterNote: optionalString,
  publicStaffDirectoryEnabled: z.coerce.boolean().default(true),
  showStaffEmail: z.coerce.boolean().default(true),
  showStaffWhatsApp: z.coerce.boolean().default(true),
  requireActivePlanForTransactions: z.coerce.boolean().default(true),
  requireActivePlanForAdminOps: z.coerce.boolean().default(false),
}).superRefine((value, ctx) => {
  if (value.verificationFreshDays >= value.verificationStaleDays) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Fresh window must be lower than the stale window.",
      path: ["verificationFreshDays"],
    });
  }
  if (value.verificationStaleDays >= value.verificationHideDays) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Hide window must be greater than the stale window.",
      path: ["verificationHideDays"],
    });
  }
  if (value.verificationWarningReminderDays >= value.verificationHideDays) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Warning reminder days must be less than the hide window.",
      path: ["verificationWarningReminderDays"],
    });
  }
});

export type TenantSettingsInput = z.infer<typeof tenantSettingsSchema>;
