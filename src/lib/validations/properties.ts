import { z } from "zod";
import { parseFlexibleNumber } from "@/lib/number";
import { SUPPORTED_CURRENCIES } from "@/lib/utils";

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
const currencySchema = z.enum(SUPPORTED_CURRENCIES);
const landSaleUnitSchema = z.enum(["SQM", "PLOT", "HECTARE", "ACRE", "CUSTOM"]);

const optionalTrimmedString = z.string().trim().optional().transform((value) => value || undefined);
const optionalNumberInput = (schema: z.ZodNumber) =>
  z.preprocess((value) => {
    if (value == null) {
      return undefined;
    }

    if (typeof value === "string" && value.trim() === "") {
      return undefined;
    }

    return typeof value === "string" ? parseFlexibleNumber(value) : value;
  }, z.number().pipe(schema).optional());
const requiredNumberInput = (schema: z.ZodNumber) =>
  z.preprocess((value) => {
    if (value == null) {
      return undefined;
    }

    if (typeof value === "string" && value.trim() === "") {
      return undefined;
    }

    return typeof value === "string" ? parseFlexibleNumber(value) : value;
  }, z.number().pipe(schema));

const optionalDateInput = z.preprocess((value) => {
  if (value == null) {
    return undefined;
  }

  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}, z.coerce.date().optional());

export const propertyUnitInputSchema = z.object({
  id: z.string().optional(),
  unitCode: z.string().trim().min(2),
  title: z.string().trim().min(2),
  status: propertyStatusSchema.default("AVAILABLE"),
  price: requiredNumberInput(z.number().positive()),
  bedrooms: optionalNumberInput(z.number().int().min(0)),
  bathrooms: optionalNumberInput(z.number().int().min(0)),
  sizeSqm: optionalNumberInput(z.number().positive()),
  floor: optionalNumberInput(z.number().int().min(0)),
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
  amount: requiredNumberInput(z.number().positive()),
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
  installmentCount: optionalNumberInput(z.number().int().min(1)),
  depositPercent: optionalNumberInput(z.number().min(0).max(100)),
  downPaymentAmount: optionalNumberInput(z.number().min(0)),
  isActive: z.coerce.boolean().default(true),
  installments: z.array(installmentInputSchema).default([]),
});

export const propertyLocationInputSchema = z.object({
  addressLine1: optionalTrimmedString,
  formattedAddress: optionalTrimmedString,
  city: z.string().trim().min(2),
  state: z.string().trim().min(2),
  country: z.string().trim().min(2).default("Nigeria"),
  latitude: optionalNumberInput(z.number().min(-90).max(90)),
  longitude: optionalNumberInput(z.number().min(-180).max(180)),
  mapboxPlaceId: optionalTrimmedString,
  neighborhood: optionalTrimmedString,
  postalCode: optionalTrimmedString,
}).superRefine((value, ctx) => {
  const hasLatitude = value.latitude != null;
  const hasLongitude = value.longitude != null;

  if (hasLatitude !== hasLongitude) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Latitude and longitude must be provided together.",
      path: hasLatitude ? ["longitude"] : ["latitude"],
    });
  }
});

export const propertyPlotOptionInputSchema = z.object({
  label: optionalTrimmedString,
  unit: landSaleUnitSchema.default("SQM"),
  sizeSqm: optionalNumberInput(z.number().positive()),
  numberOfPlots: optionalNumberInput(z.number().positive()),
  hectares: optionalNumberInput(z.number().positive()),
  acres: optionalNumberInput(z.number().positive()),
  price: optionalNumberInput(z.number().positive()),
  currency: currencySchema.optional(),
  status: propertyStatusSchema.default("AVAILABLE"),
  note: optionalTrimmedString,
}).superRefine((value, ctx) => {
  if (value.unit === "SQM" && value.sizeSqm == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "SQM option requires a size in square meters.",
      path: ["sizeSqm"],
    });
  }

  if (value.unit === "PLOT" && value.numberOfPlots == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Plot option requires number of plots.",
      path: ["numberOfPlots"],
    });
  }

  if (value.unit === "HECTARE" && value.hectares == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Hectare option requires hectares.",
      path: ["hectares"],
    });
  }

  if (value.unit === "ACRE" && value.acres == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Acre option requires acres.",
      path: ["acres"],
    });
  }

  if (value.unit === "CUSTOM" && !value.label && !value.note) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Custom option requires a label or note.",
      path: ["label"],
    });
  }
});

export const propertyMutationSchema = z.object({
  title: z.string().trim().min(3),
  shortDescription: z.string().trim().min(20),
  description: z.string().trim().min(40),
  propertyType: propertyTypeSchema,
  status: propertyStatusSchema.default("DRAFT"),
  branchId: z.string().optional(),
  isFeatured: z.coerce.boolean().default(false),
  priceFrom: requiredNumberInput(z.number().positive()),
  priceTo: optionalNumberInput(z.number().positive()),
  currency: currencySchema.default("NGN"),
  bedrooms: optionalNumberInput(z.number().int().min(0)),
  bathrooms: optionalNumberInput(z.number().int().min(0)),
  parkingSpaces: optionalNumberInput(z.number().int().min(0)),
  sizeSqm: optionalNumberInput(z.number().positive()),
  landSizeSqm: optionalNumberInput(z.number().positive()),
  numberOfPlots: optionalNumberInput(z.number().positive()),
  landSaleUnit: landSaleUnitSchema.optional(),
  hectares: optionalNumberInput(z.number().positive()),
  acres: optionalNumberInput(z.number().positive()),
  plotOptions: z.array(propertyPlotOptionInputSchema).default([]),
  brochureDocumentId: z.string().optional(),
  videoUrl: z.string().trim().url().optional().or(z.literal("")).transform((value) => value || undefined),
  offerEndsAt: optionalDateInput,
  countdownLabel: optionalTrimmedString,
  countdownEnabled: z.coerce.boolean().default(false),
  locationSummary: optionalTrimmedString,
  landmarks: z.array(z.string().trim().min(2)).default([]),
  hasPaymentPlan: z.coerce.boolean().default(false),
  wishlistDurationDays: z.coerce.number().int().min(1).max(365).optional(),
  wishlistReminderEnabled: z.coerce.boolean().default(true),
  location: propertyLocationInputSchema,
  features: z.array(propertyFeatureInputSchema).default([]),
  units: z.array(propertyUnitInputSchema).default([]),
  media: z.array(propertyMediaInputSchema).default([]),
  paymentPlans: z.array(paymentPlanInputSchema).default([]),
}).strict().superRefine((value, ctx) => {
  if (value.priceTo != null && value.priceTo < value.priceFrom) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Maximum price cannot be lower than minimum price.",
      path: ["priceTo"],
    });
  }

  if (
    value.propertyType !== "LAND" &&
    (value.landSizeSqm != null ||
      value.numberOfPlots != null ||
      value.landSaleUnit != null ||
      value.hectares != null ||
      value.acres != null ||
      value.plotOptions.length > 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Land size and plot options are only supported for land listings.",
      path: ["plotOptions"],
    });
  }

  if (value.countdownEnabled && !value.offerEndsAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Countdown requires an offer end date.",
      path: ["offerEndsAt"],
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

export const propertyVerifySchema = z.object({
  notes: z.string().trim().max(500).optional(),
});

export const propertySearchParamsSchema = z.object({
  location: z.string().trim().min(1).optional(),
  latitude: optionalNumberInput(z.number().min(-90).max(90)),
  longitude: optionalNumberInput(z.number().min(-180).max(180)),
  radiusKm: optionalNumberInput(z.number().positive().max(100)),
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
export type PropertyPlotOptionInput = z.infer<typeof propertyPlotOptionInputSchema>;
export type PaymentPlanInput = z.infer<typeof paymentPlanInputSchema>;
export type InstallmentInput = z.infer<typeof installmentInputSchema>;
export type PropertyVerifyInput = z.infer<typeof propertyVerifySchema>;
