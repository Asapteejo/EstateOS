import { Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import type { TenantContext } from "@/lib/tenancy/context";
import { rejectUnsafeCompanyIdInput } from "@/lib/tenancy/db";
import type {
  DevelopmentCalculationInput,
  DevelopmentCalculationVersionInput,
} from "@/lib/validations/development-calculations";
import {
  calculateDevelopmentFeasibility,
  createBlankDevelopmentCalculation,
  type DevelopmentCalculationResult,
} from "@/modules/development-calculations/engine";
import { getTenantAdminSettings } from "@/modules/settings/service";

type Decimalish = Prisma.Decimal | { toNumber?: () => number } | number | null | undefined;

function decimalToNumber(value: Decimalish) {
  if (value == null) {
    return 0;
  }

  return typeof value === "number" ? value : value.toNumber?.() ?? Number(value);
}

async function loadCalculationVersionMetadata(
  companyId: string,
  calculationIds: string[],
): Promise<Record<string, CalculationVersionMetadata>> {
  if (calculationIds.length === 0) {
    return {};
  }

  const rows = await prisma.$queryRaw<CalculationVersionMetadata[]>(Prisma.sql`
    SELECT
      "id",
      COALESCE("versionGroupId", "id")::text AS "versionGroupId",
      COALESCE("versionNumber", 1)::int AS "versionNumber",
      "versionLabel",
      "sourcePresetKey"
    FROM "DevelopmentCalculation"
    WHERE "companyId" = ${companyId}
      AND "id" IN (${Prisma.join(calculationIds)})
  `);

  return Object.fromEntries(rows.map((row) => [row.id, row]));
}

async function loadCalculationPhases(
  companyId: string,
  calculationIds: string[],
): Promise<Record<string, CalculationPhaseRecord[]>> {
  if (calculationIds.length === 0) {
    return {};
  }

  const rows = (await prisma.developmentCalculationPhase.findMany({
    where: {
      companyId,
      calculationId: {
        in: calculationIds,
      },
    },
    orderBy: [{ calculationId: "asc" }, { displayOrder: "asc" }],
    select: {
      id: true,
      calculationId: true,
      name: true,
      startMonthOffset: true,
      durationMonths: true,
      developmentCostShare: true,
      sellableInventoryShare: true,
      sellingPriceOverridePerSqm: true,
      sellingPriceUpliftRate: true,
      salesVelocityRate: true,
      notes: true,
      displayOrder: true,
    },
  })) as CalculationPhaseRecord[];

  return rows.reduce<Record<string, CalculationPhaseRecord[]>>((accumulator, row) => {
    if (!accumulator[row.calculationId]) {
      accumulator[row.calculationId] = [];
    }

    accumulator[row.calculationId].push(row);
    return accumulator;
  }, {});
}

function getCalculationVersionMetadata(
  metadataById: Record<string, CalculationVersionMetadata>,
  recordId: string,
): CalculationVersionMetadata {
  return (
    metadataById[recordId] ?? {
      id: recordId,
      versionGroupId: recordId,
      versionNumber: 1,
      versionLabel: null,
      sourcePresetKey: null,
    }
  );
}

const calculationSelect = Prisma.validator<Prisma.DevelopmentCalculationFindManyArgs>()({
  where: {},
  orderBy: { updatedAt: "desc" },
  select: {
    id: true,
    projectName: true,
    location: true,
    currency: true,
    landSizeHectares: true,
    landPurchasePrice: true,
    purchaseDate: true,
    projectDurationMonths: true,
    salesDurationMonths: true,
    roadsPercentage: true,
    drainagePercentage: true,
    greenAreaPercentage: true,
    utilitiesPercentage: true,
    surveyCost: true,
    legalDocumentationCost: true,
    titlePerfectionCost: true,
    siteClearingCost: true,
    sandFillingEarthworkCost: true,
    roadConstructionCost: true,
    drainageCost: true,
    powerInfrastructureCost: true,
    waterInfrastructureCost: true,
    fencingGatehouseSecurityCost: true,
    marketingSalesCommissionCost: true,
    adminCost: true,
    contingencyCost: true,
    annualInflationRate: true,
    constructionCostEscalationRate: true,
    annualSellingPriceAppreciationRate: true,
    marketRiskPremiumRate: true,
    financingCostRate: true,
    requiredTargetProfitMarginRate: true,
    saleMode: true,
    currentSellingPricePerSqm: true,
    paymentMode: true,
    installmentTenureMonths: true,
    installmentPremiumRate: true,
    useInflationAdjustedInstallmentPricing: true,
    notes: true,
    createdByUserId: true,
    updatedByUserId: true,
    archivedAt: true,
    createdAt: true,
    updatedAt: true,
    salesMixItems: {
      orderBy: { displayOrder: "asc" },
      select: {
        id: true,
        label: true,
        quantity: true,
        sizeSqm: true,
        priceMode: true,
        pricePerSqm: true,
        unitPrice: true,
        displayOrder: true,
      },
    },
  },
});

type CalculationRecord = Prisma.DevelopmentCalculationGetPayload<typeof calculationSelect>;
type CalculationVersionMetadata = {
  id: string;
  versionGroupId: string;
  versionNumber: number;
  versionLabel: string | null;
  sourcePresetKey: string | null;
};
type CalculationPhaseRecord = {
  id: string;
  calculationId: string;
  name: string;
  startMonthOffset: number;
  durationMonths: number;
  developmentCostShare: Decimalish;
  sellableInventoryShare: Decimalish;
  sellingPriceOverridePerSqm: Decimalish;
  sellingPriceUpliftRate: Decimalish;
  salesVelocityRate: Decimalish;
  notes: string | null;
  displayOrder: number;
};

export type DevelopmentCalculationListItem = {
  id: string;
  projectName: string;
  versionGroupId: string;
  versionNumber: number;
  versionLabel: string | null;
  sourcePresetKey: string | null;
  location: string | null;
  saleMode: string;
  paymentMode: string;
  updatedAt: string;
  sellableSqm: number;
  adjustedTotalCost: number;
  estimatedRevenue: number;
  roiPercent: number;
  marginPercent: number;
};

export type DevelopmentCalculationDetail = {
  id: string;
  versionGroupId: string;
  versionNumber: number;
  versionLabel: string | null;
  sourcePresetKey: string | null;
  form: DevelopmentCalculationInput;
  result: DevelopmentCalculationResult;
  createdAt: string;
  updatedAt: string;
};

export type DevelopmentCalculationVersionListItem = {
  id: string;
  projectName: string;
  versionGroupId: string;
  versionNumber: number;
  versionLabel: string | null;
  sourcePresetKey: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DevelopmentCalculationWorkspace = {
  defaultCurrency: string;
  calculations: DevelopmentCalculationListItem[];
  selected: DevelopmentCalculationDetail | null;
  versions: DevelopmentCalculationVersionListItem[];
  blankForm: DevelopmentCalculationInput;
};

function mapRecordToInput(
  record: CalculationRecord,
  phases: CalculationPhaseRecord[] = [],
): DevelopmentCalculationInput {
  return {
    projectName: record.projectName,
    location: record.location ?? "",
    notes: record.notes ?? "",
    currency: record.currency,
    landSizeHectares: decimalToNumber(record.landSizeHectares),
    landPurchasePrice: decimalToNumber(record.landPurchasePrice),
    purchaseDate: record.purchaseDate ? record.purchaseDate.toISOString().slice(0, 10) : "",
    projectDurationMonths: record.projectDurationMonths,
    salesDurationMonths: record.salesDurationMonths,
    roadsPercentage: decimalToNumber(record.roadsPercentage),
    drainagePercentage: decimalToNumber(record.drainagePercentage),
    greenAreaPercentage: decimalToNumber(record.greenAreaPercentage),
    utilitiesPercentage: decimalToNumber(record.utilitiesPercentage),
    surveyCost: decimalToNumber(record.surveyCost),
    legalDocumentationCost: decimalToNumber(record.legalDocumentationCost),
    titlePerfectionCost: decimalToNumber(record.titlePerfectionCost),
    siteClearingCost: decimalToNumber(record.siteClearingCost),
    sandFillingEarthworkCost: decimalToNumber(record.sandFillingEarthworkCost),
    roadConstructionCost: decimalToNumber(record.roadConstructionCost),
    drainageCost: decimalToNumber(record.drainageCost),
    powerInfrastructureCost: decimalToNumber(record.powerInfrastructureCost),
    waterInfrastructureCost: decimalToNumber(record.waterInfrastructureCost),
    fencingGatehouseSecurityCost: decimalToNumber(record.fencingGatehouseSecurityCost),
    marketingSalesCommissionCost: decimalToNumber(record.marketingSalesCommissionCost),
    adminCost: decimalToNumber(record.adminCost),
    contingencyCost: decimalToNumber(record.contingencyCost),
    annualInflationRate: decimalToNumber(record.annualInflationRate),
    constructionCostEscalationRate: decimalToNumber(record.constructionCostEscalationRate),
    annualSellingPriceAppreciationRate: decimalToNumber(record.annualSellingPriceAppreciationRate),
    marketRiskPremiumRate: decimalToNumber(record.marketRiskPremiumRate),
    financingCostRate: decimalToNumber(record.financingCostRate),
    requiredTargetProfitMarginRate: decimalToNumber(record.requiredTargetProfitMarginRate),
    saleMode: record.saleMode,
    currentSellingPricePerSqm: record.currentSellingPricePerSqm
      ? decimalToNumber(record.currentSellingPricePerSqm)
      : undefined,
    paymentMode: record.paymentMode,
    installmentTenureMonths: record.installmentTenureMonths ?? undefined,
    installmentPremiumRate: record.installmentPremiumRate
      ? decimalToNumber(record.installmentPremiumRate)
      : undefined,
    useInflationAdjustedInstallmentPricing: record.useInflationAdjustedInstallmentPricing,
    salesMixItems: record.salesMixItems.map((item) => ({
      id: item.id,
      label: item.label,
      quantity: item.quantity,
      sizeSqm: decimalToNumber(item.sizeSqm),
      priceMode: item.priceMode,
      pricePerSqm: item.pricePerSqm ? decimalToNumber(item.pricePerSqm) : undefined,
      unitPrice: item.unitPrice ? decimalToNumber(item.unitPrice) : undefined,
    })),
    phases: phases.map((phase) => ({
      id: phase.id,
      name: phase.name,
      startMonthOffset: phase.startMonthOffset,
      durationMonths: phase.durationMonths,
      developmentCostShare: decimalToNumber(phase.developmentCostShare),
      sellableInventoryShare: decimalToNumber(phase.sellableInventoryShare),
      sellingPriceOverridePerSqm: phase.sellingPriceOverridePerSqm
        ? decimalToNumber(phase.sellingPriceOverridePerSqm)
        : undefined,
      sellingPriceUpliftRate: phase.sellingPriceUpliftRate
        ? decimalToNumber(phase.sellingPriceUpliftRate)
        : undefined,
      salesVelocityRate: decimalToNumber(phase.salesVelocityRate),
      notes: phase.notes ?? "",
    })),
  };
}

function mapRecordToListItem(
  record: CalculationRecord,
  versionMeta: CalculationVersionMetadata,
  phases: CalculationPhaseRecord[] = [],
): DevelopmentCalculationListItem {
  const input = mapRecordToInput(record, phases);
  const result = calculateDevelopmentFeasibility(input);

  return {
    id: record.id,
    projectName: record.projectName,
    versionGroupId: versionMeta.versionGroupId,
    versionNumber: versionMeta.versionNumber,
    versionLabel: versionMeta.versionLabel,
    sourcePresetKey: versionMeta.sourcePresetKey,
    location: record.location,
    saleMode: record.saleMode,
    paymentMode: record.paymentMode,
    updatedAt: record.updatedAt.toISOString(),
    sellableSqm: result.area.sellableSqm,
    adjustedTotalCost: result.costs.adjustedTotalCost,
    estimatedRevenue: result.revenue.estimatedRevenue,
    roiPercent: result.revenue.roiPercent,
    marginPercent: result.revenue.marginPercent,
  };
}

function mapRecordToVersionListItem(
  record: CalculationRecord,
  versionMeta: CalculationVersionMetadata,
): DevelopmentCalculationVersionListItem {
  return {
    id: record.id,
    projectName: record.projectName,
    versionGroupId: versionMeta.versionGroupId,
    versionNumber: versionMeta.versionNumber,
    versionLabel: versionMeta.versionLabel,
    sourcePresetKey: versionMeta.sourcePresetKey,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function buildBlankForm(currency: string) {
  return createBlankDevelopmentCalculation(currency);
}

async function getDefaultCurrency(context: TenantContext) {
  const settings = await getTenantAdminSettings(context);
  return settings.defaultCurrency || "NGN";
}

export async function getDevelopmentCalculationWorkspace(
  context: TenantContext,
  selectedId?: string | null,
): Promise<DevelopmentCalculationWorkspace> {
  const defaultCurrency = await getDefaultCurrency(context);
  const blankForm = buildBlankForm(defaultCurrency);

  if (!featureFlags.hasDatabase || !context.companyId) {
    return {
      defaultCurrency,
      calculations: [],
      selected: null,
      versions: [],
      blankForm,
    };
  }

  const records = await prisma.developmentCalculation.findMany({
    ...calculationSelect,
    where: {
      companyId: context.companyId,
      archivedAt: null,
    },
  });

  const selectedRecord =
    (selectedId
      ? records.find((record) => record.id === selectedId) ??
        (await prisma.developmentCalculation.findFirst({
          ...calculationSelect,
          where: {
            id: selectedId,
            companyId: context.companyId,
            archivedAt: null,
          },
        }))
      : null) ?? null;
  const phasesByCalculationId = await loadCalculationPhases(
    context.companyId,
    records.map((record) => record.id),
  );
  const versionMetadataById = await loadCalculationVersionMetadata(
    context.companyId,
    records.map((record) => record.id),
  );

  const versionGroupId = selectedRecord
    ? getCalculationVersionMetadata(versionMetadataById, selectedRecord.id).versionGroupId
    : null;
  const versions =
    versionGroupId == null
      ? []
      : records
          .filter(
            (record) =>
              getCalculationVersionMetadata(versionMetadataById, record.id).versionGroupId ===
              versionGroupId,
          )
          .sort(
            (left, right) =>
              getCalculationVersionMetadata(versionMetadataById, left.id).versionNumber -
              getCalculationVersionMetadata(versionMetadataById, right.id).versionNumber,
          )
          .map((record) =>
            mapRecordToVersionListItem(
              record,
              getCalculationVersionMetadata(versionMetadataById, record.id),
            ),
          );

  return {
    defaultCurrency,
    calculations: records.map((record) =>
      mapRecordToListItem(
        record,
        getCalculationVersionMetadata(versionMetadataById, record.id),
        phasesByCalculationId[record.id] ?? [],
      ),
    ),
    selected: selectedRecord
      ? {
          id: selectedRecord.id,
          versionGroupId: getCalculationVersionMetadata(versionMetadataById, selectedRecord.id).versionGroupId,
          versionNumber: getCalculationVersionMetadata(versionMetadataById, selectedRecord.id).versionNumber,
          versionLabel: getCalculationVersionMetadata(versionMetadataById, selectedRecord.id).versionLabel,
          sourcePresetKey: getCalculationVersionMetadata(versionMetadataById, selectedRecord.id).sourcePresetKey,
          form: mapRecordToInput(selectedRecord, phasesByCalculationId[selectedRecord.id] ?? []),
          result: calculateDevelopmentFeasibility(
            mapRecordToInput(selectedRecord, phasesByCalculationId[selectedRecord.id] ?? []),
          ),
          createdAt: selectedRecord.createdAt.toISOString(),
          updatedAt: selectedRecord.updatedAt.toISOString(),
        }
      : null,
    versions,
    blankForm,
  };
}

export async function getDevelopmentCalculationDetail(
  context: TenantContext,
  calculationId: string,
): Promise<DevelopmentCalculationDetail | null> {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return null;
  }

  const record = await prisma.developmentCalculation.findFirst({
    ...calculationSelect,
    where: {
      id: calculationId,
      companyId: context.companyId,
      archivedAt: null,
    },
  });

  if (!record) {
    return null;
  }

  const phasesByCalculationId = await loadCalculationPhases(context.companyId, [record.id]);
  const form = mapRecordToInput(record, phasesByCalculationId[record.id] ?? []);
  const versionMetadataById = await loadCalculationVersionMetadata(context.companyId, [record.id]);
  const versionMeta = getCalculationVersionMetadata(versionMetadataById, record.id);

  return {
    id: record.id,
    versionGroupId: versionMeta.versionGroupId,
    versionNumber: versionMeta.versionNumber,
    versionLabel: versionMeta.versionLabel,
    sourcePresetKey: versionMeta.sourcePresetKey,
    form,
    result: calculateDevelopmentFeasibility(form),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function buildPersistenceData(context: TenantContext, input: DevelopmentCalculationInput) {
  return {
    projectName: input.projectName,
    location: input.location || null,
    notes: input.notes || null,
    currency: input.currency,
    landSizeHectares: input.landSizeHectares,
    landPurchasePrice: input.landPurchasePrice,
    purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null,
    projectDurationMonths: input.projectDurationMonths,
    salesDurationMonths: input.salesDurationMonths,
    roadsPercentage: input.roadsPercentage,
    drainagePercentage: input.drainagePercentage,
    greenAreaPercentage: input.greenAreaPercentage,
    utilitiesPercentage: input.utilitiesPercentage,
    surveyCost: input.surveyCost,
    legalDocumentationCost: input.legalDocumentationCost,
    titlePerfectionCost: input.titlePerfectionCost,
    siteClearingCost: input.siteClearingCost,
    sandFillingEarthworkCost: input.sandFillingEarthworkCost,
    roadConstructionCost: input.roadConstructionCost,
    drainageCost: input.drainageCost,
    powerInfrastructureCost: input.powerInfrastructureCost,
    waterInfrastructureCost: input.waterInfrastructureCost,
    fencingGatehouseSecurityCost: input.fencingGatehouseSecurityCost,
    marketingSalesCommissionCost: input.marketingSalesCommissionCost,
    adminCost: input.adminCost,
    contingencyCost: input.contingencyCost,
    annualInflationRate: input.annualInflationRate,
    constructionCostEscalationRate: input.constructionCostEscalationRate,
    annualSellingPriceAppreciationRate: input.annualSellingPriceAppreciationRate,
    marketRiskPremiumRate: input.marketRiskPremiumRate,
    financingCostRate: input.financingCostRate,
    requiredTargetProfitMarginRate: input.requiredTargetProfitMarginRate,
    saleMode: input.saleMode,
    currentSellingPricePerSqm: input.currentSellingPricePerSqm ?? null,
    paymentMode: input.paymentMode,
    installmentTenureMonths:
      input.paymentMode === "INSTALLMENT" ? input.installmentTenureMonths ?? null : null,
    installmentPremiumRate:
      input.paymentMode === "INSTALLMENT" ? input.installmentPremiumRate ?? null : null,
    useInflationAdjustedInstallmentPricing:
      input.paymentMode === "INSTALLMENT" ? input.useInflationAdjustedInstallmentPricing : false,
    updatedByUserId: context.userId,
  };
}

export async function createDevelopmentCalculation(
  context: TenantContext,
  rawInput: DevelopmentCalculationInput & Record<string, unknown>,
) {
  rejectUnsafeCompanyIdInput(rawInput);

  if (!context.companyId) {
    throw new Error("Tenant context is required.");
  }

  if (!featureFlags.hasDatabase) {
    throw new Error("Database-backed calculation persistence is unavailable.");
  }

  const created = await prisma.$transaction(async (tx) => {
    const calculation = await tx.developmentCalculation.create({
      data: {
        companyId: context.companyId!,
        createdByUserId: context.userId,
        ...buildPersistenceData(context, rawInput),
      },
      select: {
        id: true,
      },
    });

    await tx.$executeRaw`
      UPDATE "DevelopmentCalculation"
      SET "versionGroupId" = ${calculation.id}, "versionNumber" = 1
      WHERE "id" = ${calculation.id}
    `;

    if (rawInput.salesMixItems.length > 0) {
      await tx.developmentCalculationSalesMixItem.createMany({
        data: rawInput.salesMixItems.map((item, index) => ({
          companyId: context.companyId!,
          calculationId: calculation.id,
          label: item.label,
          quantity: item.quantity,
          sizeSqm: item.sizeSqm,
          priceMode: item.priceMode,
          pricePerSqm: item.priceMode === "PER_SQM" ? item.pricePerSqm ?? null : null,
          unitPrice: item.priceMode === "PER_UNIT" ? item.unitPrice ?? null : null,
          displayOrder: index,
        })),
      });
    }

    if (rawInput.phases.length > 0) {
      await tx.developmentCalculationPhase.createMany({
        data: rawInput.phases.map((phase, index) => ({
          companyId: context.companyId!,
          calculationId: calculation.id,
          name: phase.name,
          startMonthOffset: phase.startMonthOffset,
          durationMonths: phase.durationMonths,
          developmentCostShare: phase.developmentCostShare,
          sellableInventoryShare: phase.sellableInventoryShare,
          sellingPriceOverridePerSqm: phase.sellingPriceOverridePerSqm ?? null,
          sellingPriceUpliftRate: phase.sellingPriceUpliftRate ?? null,
          salesVelocityRate: phase.salesVelocityRate,
          notes: phase.notes || null,
          displayOrder: index,
        })),
      });
    }

    return calculation;
  });

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId ?? undefined,
    action: "CREATE",
    entityType: "development_calculation",
    entityId: created.id,
    summary: `Created feasibility project ${rawInput.projectName}.`,
  });

  const detail = await getDevelopmentCalculationDetail(context, created.id);

  if (!detail) {
    throw new Error("Unable to load the saved calculation.");
  }

  return {
    ...detail,
    redirectTo: `/admin/feasibility/${created.id}`,
  };
}

export async function createDevelopmentCalculationVersion(
  context: TenantContext,
  calculationId: string,
  rawInput: DevelopmentCalculationVersionInput & Record<string, unknown>,
) {
  rejectUnsafeCompanyIdInput(rawInput);

  if (!context.companyId) {
    throw new Error("Tenant context is required.");
  }

  if (!featureFlags.hasDatabase) {
    throw new Error("Database-backed calculation persistence is unavailable.");
  }

  const source = await prisma.developmentCalculation.findFirst({
    where: {
      id: calculationId,
      companyId: context.companyId,
      archivedAt: null,
    },
    select: {
      id: true,
      projectName: true,
    },
  });

  if (!source) {
    throw new Error("Feasibility project not found.");
  }

  const sourceVersionMetadataById = await loadCalculationVersionMetadata(context.companyId, [source.id]);
  const sourceVersionMeta = getCalculationVersionMetadata(sourceVersionMetadataById, source.id);
  const versionGroupId = sourceVersionMeta.versionGroupId;
  const versionAggregate = await prisma.$queryRaw<Array<{ maxVersionNumber: number | null }>>(Prisma.sql`
    SELECT MAX(COALESCE("versionNumber", 1))::int AS "maxVersionNumber"
    FROM "DevelopmentCalculation"
    WHERE "companyId" = ${context.companyId}
      AND "archivedAt" IS NULL
      AND COALESCE("versionGroupId", "id") = ${versionGroupId}
  `);
  const nextVersionNumber = (versionAggregate[0]?.maxVersionNumber ?? sourceVersionMeta.versionNumber) + 1;

  const created = await prisma.$transaction(async (tx) => {
    const calculation = await tx.developmentCalculation.create({
      data: {
        companyId: context.companyId!,
        createdByUserId: context.userId,
        ...buildPersistenceData(context, rawInput.form),
      },
      select: {
        id: true,
      },
    });

    if (rawInput.form.salesMixItems.length > 0) {
      await tx.developmentCalculationSalesMixItem.createMany({
        data: rawInput.form.salesMixItems.map((item, index) => ({
          companyId: context.companyId!,
          calculationId: calculation.id,
          label: item.label,
          quantity: item.quantity,
          sizeSqm: item.sizeSqm,
          priceMode: item.priceMode,
          pricePerSqm: item.priceMode === "PER_SQM" ? item.pricePerSqm ?? null : null,
          unitPrice: item.priceMode === "PER_UNIT" ? item.unitPrice ?? null : null,
          displayOrder: index,
        })),
      });
    }

    if (rawInput.form.phases.length > 0) {
      await tx.developmentCalculationPhase.createMany({
        data: rawInput.form.phases.map((phase, index) => ({
          companyId: context.companyId!,
          calculationId: calculation.id,
          name: phase.name,
          startMonthOffset: phase.startMonthOffset,
          durationMonths: phase.durationMonths,
          developmentCostShare: phase.developmentCostShare,
          sellableInventoryShare: phase.sellableInventoryShare,
          sellingPriceOverridePerSqm: phase.sellingPriceOverridePerSqm ?? null,
          sellingPriceUpliftRate: phase.sellingPriceUpliftRate ?? null,
          salesVelocityRate: phase.salesVelocityRate,
          notes: phase.notes || null,
          displayOrder: index,
        })),
      });
    }

    await tx.$executeRaw`
      UPDATE "DevelopmentCalculation"
      SET
        "versionGroupId" = ${versionGroupId},
        "versionNumber" = ${nextVersionNumber},
        "versionLabel" = ${rawInput.versionLabel},
        "sourcePresetKey" = ${rawInput.sourcePresetKey ?? null}
      WHERE "id" = ${calculation.id}
    `;

    return calculation;
  });

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId ?? undefined,
    action: "CREATE",
    entityType: "development_calculation_version",
    entityId: created.id,
    summary: `Saved feasibility version ${rawInput.versionLabel} for ${source.projectName}.`,
  });

  const detail = await getDevelopmentCalculationDetail(context, created.id);

  if (!detail) {
    throw new Error("Unable to load the saved version.");
  }

  return {
    ...detail,
    redirectTo: `/admin/feasibility/${created.id}`,
  };
}

export async function updateDevelopmentCalculation(
  context: TenantContext,
  calculationId: string,
  rawInput: DevelopmentCalculationInput & Record<string, unknown>,
) {
  rejectUnsafeCompanyIdInput(rawInput);

  if (!context.companyId) {
    throw new Error("Tenant context is required.");
  }

  if (!featureFlags.hasDatabase) {
    throw new Error("Database-backed calculation persistence is unavailable.");
  }

  const existing = await prisma.developmentCalculation.findFirst({
    where: {
      id: calculationId,
      companyId: context.companyId,
      archivedAt: null,
    },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("Feasibility project not found.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.developmentCalculation.update({
      where: { id: existing.id },
      data: buildPersistenceData(context, rawInput),
    });

    await tx.developmentCalculationSalesMixItem.deleteMany({
      where: {
        calculationId: existing.id,
        companyId: context.companyId!,
      },
    });

    await tx.developmentCalculationPhase.deleteMany({
      where: {
        calculationId: existing.id,
        companyId: context.companyId!,
      },
    });

    if (rawInput.salesMixItems.length > 0) {
      await tx.developmentCalculationSalesMixItem.createMany({
        data: rawInput.salesMixItems.map((item, index) => ({
          companyId: context.companyId!,
          calculationId: existing.id,
          label: item.label,
          quantity: item.quantity,
          sizeSqm: item.sizeSqm,
          priceMode: item.priceMode,
          pricePerSqm: item.priceMode === "PER_SQM" ? item.pricePerSqm ?? null : null,
          unitPrice: item.priceMode === "PER_UNIT" ? item.unitPrice ?? null : null,
          displayOrder: index,
        })),
      });
    }

    if (rawInput.phases.length > 0) {
      await tx.developmentCalculationPhase.createMany({
        data: rawInput.phases.map((phase, index) => ({
          companyId: context.companyId!,
          calculationId: existing.id,
          name: phase.name,
          startMonthOffset: phase.startMonthOffset,
          durationMonths: phase.durationMonths,
          developmentCostShare: phase.developmentCostShare,
          sellableInventoryShare: phase.sellableInventoryShare,
          sellingPriceOverridePerSqm: phase.sellingPriceOverridePerSqm ?? null,
          sellingPriceUpliftRate: phase.sellingPriceUpliftRate ?? null,
          salesVelocityRate: phase.salesVelocityRate,
          notes: phase.notes || null,
          displayOrder: index,
        })),
      });
    }
  });

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId ?? undefined,
    action: "UPDATE",
    entityType: "development_calculation",
    entityId: existing.id,
    summary: `Updated feasibility project ${rawInput.projectName}.`,
  });

  const detail = await getDevelopmentCalculationDetail(context, existing.id);

  if (!detail) {
    throw new Error("Unable to load the updated calculation.");
  }

  return detail;
}

export async function archiveDevelopmentCalculation(
  context: TenantContext,
  calculationId: string,
) {
  if (!context.companyId) {
    throw new Error("Tenant context is required.");
  }

  if (!featureFlags.hasDatabase) {
    throw new Error("Database-backed calculation persistence is unavailable.");
  }

  const updated = await prisma.developmentCalculation.updateMany({
    where: {
      id: calculationId,
      companyId: context.companyId,
      archivedAt: null,
    },
    data: {
      archivedAt: new Date(),
      updatedByUserId: context.userId,
    },
  });

  if (updated.count < 1) {
    throw new Error("Feasibility project not found.");
  }

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId ?? undefined,
    action: "DELETE",
    entityType: "development_calculation",
    entityId: calculationId,
    summary: "Archived a feasibility project.",
  });

  return {
    id: calculationId,
    archived: true,
  };
}
