import { z } from "zod";

const propertyStatusSchema = z.enum([
  "DRAFT",
  "AVAILABLE",
  "RESERVED",
  "SOLD",
  "ARCHIVED",
]);

const propertyTypeSchema = z.enum([
  "APARTMENT",
  "DUPLEX",
  "TERRACE",
  "DETACHED",
  "SEMI_DETACHED",
  "LAND",
  "COMMERCIAL",
]);

const propertyMediaVisibilitySchema = z.enum(["PUBLIC", "PRIVATE"]);
const paymentPlanKindSchema = z.enum(["ONE_TIME", "FIXED", "CUSTOM"]);

const optionalTrimmedString = z.string().trim().optional().transform((value) => value || undefined);

export const propertyUnitInputSchema = z.object({
  id: z.string().optional(),
  unitCode: z.string().trim().min(2),
  title: z.string().trim().min(2),
  status: propertyStatusSchema.default("AVAILABLE"),
  price: z.coerce.number().positive(),
  bedrooms: z.coerce.number().int().min(0).optional(),
  bathrooms: z.coerce.number().int().min(0).optional(),
  sizeSqm: z.coerce.number().positive().optional(),
  floor: z.coerce.number().int().min(0).optional(),
  block: optionalTrimmedString,
});

export const propertyMediaInputSchema = z.object({
  id: z.string().optional(),
  title: optionalTrimmedString,
  url: z.string().trim().url(),
  mimeType: optionalTrimmedString,
  sortOrder: z.coerce.number().int().min(0).default(0),
  isPrimary: z.coerce.boolean().default(false),
  visibility: propertyMediaVisibilitySchema.default("PUBLIC"),
});

export const propertyFeatureInputSchema = z.object({
  label: z.string().trim().min(2),
  value: optionalTrimmedString,
});

export const installmentInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(2),
  amount: z.coerce.number().positive(),
  dueInDays: z.coerce.number().int().min(0),
  scheduleLabel: optionalTrimmedString,
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const paymentPlanInputSchema = z.object({
  id: z.string().optional(),
  propertyUnitId: z.string().optional(),
  title: z.string().trim().min(2),
  kind: paymentPlanKindSchema.default("FIXED"),
  description: optionalTrimmedString,
  scheduleDescription: optionalTrimmedString,
  durationMonths: z.coerce.number().int().min(0),
  installmentCount: z.coerce.number().int().min(1).optional(),
  depositPercent: z.coerce.number().min(0).max(100).optional(),
  downPaymentAmount: z.coerce.number().min(0).optional(),
  isActive: z.coerce.boolean().default(true),
  installments: z.array(installmentInputSchema).default([]),
});

export const propertyLocationInputSchema = z.object({
  addressLine1: optionalTrimmedString,
  city: z.string().trim().min(2),
  state: z.string().trim().min(2),
  country: z.string().trim().min(2).default("Nigeria"),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  neighborhood: optionalTrimmedString,
  postalCode: optionalTrimmedString,
});

export const propertyMutationSchema = z.object({
  title: z.string().trim().min(3),
  shortDescription: z.string().trim().min(20),
  description: z.string().trim().min(40),
  propertyType: propertyTypeSchema,
  status: propertyStatusSchema.default("DRAFT"),
  branchId: z.string().optional(),
  isFeatured: z.coerce.boolean().default(false),
  priceFrom: z.coerce.number().positive(),
  priceTo: z.coerce.number().positive().optional(),
  currency: z.string().trim().min(3).default("NGN"),
  bedrooms: z.coerce.number().int().min(0).optional(),
  bathrooms: z.coerce.number().int().min(0).optional(),
  parkingSpaces: z.coerce.number().int().min(0).optional(),
  sizeSqm: z.coerce.number().positive().optional(),
  brochureDocumentId: z.string().optional(),
  videoUrl: z.string().trim().url().optional().or(z.literal("")).transform((value) => value || undefined),
  locationSummary: optionalTrimmedString,
  landmarks: z.array(z.string().trim().min(2)).default([]),
  hasPaymentPlan: z.coerce.boolean().default(false),
  location: propertyLocationInputSchema,
  features: z.array(propertyFeatureInputSchema).default([]),
  units: z.array(propertyUnitInputSchema).default([]),
  media: z.array(propertyMediaInputSchema).default([]),
  paymentPlans: z.array(paymentPlanInputSchema).default([]),
}).superRefine((value, ctx) => {
  if (value.priceTo != null && value.priceTo < value.priceFrom) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Maximum price cannot be lower than minimum price.",
      path: ["priceTo"],
    });
  }

  const primaryMediaCount = value.media.filter((item) => item.isPrimary).length;
  if (primaryMediaCount > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Only one media item can be marked as primary.",
      path: ["media"],
    });
  }

  for (const [index, plan] of value.paymentPlans.entries()) {
    if (plan.installmentCount != null && plan.installments.length > 0 && plan.installmentCount !== plan.installments.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Installment count must match the number of installment rows.",
        path: ["paymentPlans", index, "installmentCount"],
      });
    }

    if (plan.kind === "ONE_TIME" && plan.installments.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "One-time plans can only contain one installment row.",
        path: ["paymentPlans", index, "installments"],
      });
    }

    if ((plan.kind === "FIXED" || plan.kind === "CUSTOM") && plan.installments.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Installment plans must define at least one installment row.",
        path: ["paymentPlans", index, "installments"],
      });
    }
  }
});

export const propertyCreateSchema = propertyMutationSchema;

export const propertyUpdateSchema = propertyMutationSchema;

export const propertyStatusUpdateSchema = z.object({
  status: propertyStatusSchema,
});

export const propertySearchParamsSchema = z.object({
  location: z.string().trim().min(1).optional(),
  propertyType: propertyTypeSchema.optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  bedrooms: z.coerce.number().int().positive().optional(),
  status: z.enum(["AVAILABLE", "RESERVED", "SOLD"]).optional(),
  hasPaymentPlan: z.coerce.boolean().optional(),
  featured: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
}).refine(
  (value) =>
    value.minPrice == null ||
    value.maxPrice == null ||
    value.minPrice <= value.maxPrice,
  {
    message: "Minimum price cannot exceed maximum price.",
    path: ["maxPrice"],
  },
);

export type PropertySearchParams = z.infer<typeof propertySearchParamsSchema>;
export type PropertyMutationInput = z.infer<typeof propertyMutationSchema>;
export type PropertyUnitInput = z.infer<typeof propertyUnitInputSchema>;
export type PropertyMediaInput = z.infer<typeof propertyMediaInputSchema>;
export type PaymentPlanInput = z.infer<typeof paymentPlanInputSchema>;
export type InstallmentInput = z.infer<typeof installmentInputSchema>;
