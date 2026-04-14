import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((value) => value || undefined);

const optionalDate = z
  .string()
  .trim()
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((value, ctx) => {
    if (!value) {
      return undefined;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid date.",
      });
      return z.NEVER;
    }

    return value;
  });

const nonNegativeMoney = z.coerce.number().min(0);
const percentage = z.coerce.number().min(0).max(100);
const signedPercentage = z.coerce.number().min(-100).max(500);

export const developmentSalesMixItemSchema = z.object({
  id: z.string().trim().optional(),
  label: z.string().trim().min(2).max(120),
  quantity: z.coerce.number().int().min(1).max(100000),
  sizeSqm: z.coerce.number().positive().max(1000000),
  priceMode: z.enum(["PER_SQM", "PER_UNIT"]),
  pricePerSqm: z.coerce.number().positive().optional(),
  unitPrice: z.coerce.number().positive().optional(),
}).superRefine((value, ctx) => {
  if (value.priceMode === "PER_SQM" && value.pricePerSqm == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["pricePerSqm"],
      message: "Price per sqm is required for this sales item.",
    });
  }

  if (value.priceMode === "PER_UNIT" && value.unitPrice == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["unitPrice"],
      message: "Unit selling price is required for this sales item.",
    });
  }
});

export const developmentCalculationPhaseSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(2).max(120),
  startMonthOffset: z.coerce.number().int().min(0).max(240),
  durationMonths: z.coerce.number().int().min(1).max(240),
  developmentCostShare: percentage,
  sellableInventoryShare: percentage,
  sellingPriceOverridePerSqm: nonNegativeMoney.optional(),
  sellingPriceUpliftRate: signedPercentage.optional(),
  salesVelocityRate: percentage,
  notes: optionalString,
});

export const developmentCalculationSchema = z.object({
  projectName: z.string().trim().min(3).max(160),
  location: optionalString,
  notes: optionalString,
  currency: z.string().trim().min(3).max(3).default("NGN").transform((value) => value.toUpperCase()),
  landSizeHectares: z.coerce.number().positive().max(100000),
  landPurchasePrice: nonNegativeMoney,
  purchaseDate: optionalDate,
  projectDurationMonths: z.coerce.number().int().min(1).max(240),
  salesDurationMonths: z.coerce.number().int().min(1).max(240),
  roadsPercentage: percentage,
  drainagePercentage: percentage,
  greenAreaPercentage: percentage,
  utilitiesPercentage: percentage,
  surveyCost: nonNegativeMoney,
  legalDocumentationCost: nonNegativeMoney,
  titlePerfectionCost: nonNegativeMoney,
  siteClearingCost: nonNegativeMoney,
  sandFillingEarthworkCost: nonNegativeMoney,
  roadConstructionCost: nonNegativeMoney,
  drainageCost: nonNegativeMoney,
  powerInfrastructureCost: nonNegativeMoney,
  waterInfrastructureCost: nonNegativeMoney,
  fencingGatehouseSecurityCost: nonNegativeMoney,
  marketingSalesCommissionCost: nonNegativeMoney,
  adminCost: nonNegativeMoney,
  contingencyCost: nonNegativeMoney,
  annualInflationRate: percentage,
  constructionCostEscalationRate: percentage,
  annualSellingPriceAppreciationRate: percentage,
  marketRiskPremiumRate: percentage,
  financingCostRate: percentage,
  requiredTargetProfitMarginRate: percentage,
  saleMode: z.enum(["PER_SQM", "PER_PLOT", "MIXED"]),
  currentSellingPricePerSqm: z.coerce.number().positive().optional(),
  paymentMode: z.enum(["OUTRIGHT", "INSTALLMENT"]),
  installmentTenureMonths: z.coerce.number().int().min(1).max(120).optional(),
  installmentPremiumRate: percentage.optional(),
  useInflationAdjustedInstallmentPricing: z.coerce.boolean().default(false),
  salesMixItems: z.array(developmentSalesMixItemSchema).default([]),
  phases: z.array(developmentCalculationPhaseSchema).default([]),
}).superRefine((value, ctx) => {
  const reservedPercentage =
    value.roadsPercentage +
    value.drainagePercentage +
    value.greenAreaPercentage +
    value.utilitiesPercentage;

  if (reservedPercentage >= 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["utilitiesPercentage"],
      message: "Reserved land must stay below 100% so some area remains sellable.",
    });
  }

  const grossSqm = value.landSizeHectares * 10000;
  const sellableSqm = grossSqm * (1 - reservedPercentage / 100);
  const allocatedSqm = value.salesMixItems.reduce(
    (sum, item) => sum + item.sizeSqm * item.quantity,
    0,
  );
  const totalDevelopmentCostShare = value.phases.reduce(
    (sum, phase) => sum + phase.developmentCostShare,
    0,
  );
  const totalSellableInventoryShare = value.phases.reduce(
    (sum, phase) => sum + phase.sellableInventoryShare,
    0,
  );

  if (value.saleMode === "PER_SQM" && value.currentSellingPricePerSqm == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["currentSellingPricePerSqm"],
      message: "Current selling price per sqm is required in per-sqm mode.",
    });
  }

  if (value.saleMode !== "PER_SQM" && value.salesMixItems.length < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["salesMixItems"],
      message: "Add at least one sales category for plot or mixed sales mode.",
    });
  }

  if (value.saleMode !== "PER_SQM" && allocatedSqm > sellableSqm) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["salesMixItems"],
      message: "Sales mix allocates more land than the calculated sellable area.",
    });
  }

  if (value.paymentMode === "INSTALLMENT" && value.installmentTenureMonths == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["installmentTenureMonths"],
      message: "Installment tenure is required when installment mode is enabled.",
    });
  }

  if (value.paymentMode === "INSTALLMENT" && value.installmentPremiumRate == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["installmentPremiumRate"],
      message: "Installment premium is required when installment mode is enabled.",
    });
  }

  if (totalDevelopmentCostShare > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["phases"],
      message: "Phase development cost shares cannot exceed 100% in total.",
    });
  }

  if (totalSellableInventoryShare > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["phases"],
      message: "Phase sellable inventory shares cannot exceed 100% in total.",
    });
  }
});

export const developmentCalculationVersionSchema = z.object({
  versionLabel: z.string().trim().min(2).max(120),
  sourcePresetKey: optionalString,
  form: developmentCalculationSchema,
});

export type DevelopmentCalculationInput = z.infer<typeof developmentCalculationSchema>;
export type DevelopmentSalesMixItemInput = z.infer<typeof developmentSalesMixItemSchema>;
export type DevelopmentCalculationPhaseInput = z.infer<typeof developmentCalculationPhaseSchema>;
export type DevelopmentCalculationVersionInput = z.infer<typeof developmentCalculationVersionSchema>;
