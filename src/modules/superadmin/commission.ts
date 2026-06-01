import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { buildSafeErrorLogContext, logError } from "@/lib/ops/logger";
import type { TenantContext } from "@/lib/tenancy/context";

const PLATFORM_COMMISSION_CODE = "superadmin-platform-default";

function decimalToNumber(value: { toNumber?: () => number } | number | null | undefined) {
  if (value == null) return null;
  return typeof value === "number" ? value : value.toNumber?.() ?? Number(value);
}

export function canManagePlatformCommission(context: Pick<TenantContext, "roles">) {
  return context.roles.includes("SUPER_ADMIN");
}

export function buildDefaultPlatformCommissionControl() {
  return {
    commissionPercentage: 0,
    fixedFee: 0,
    notes: "",
  };
}

export async function getPlatformCommissionControl(companyId: string) {
  if (!featureFlags.hasDatabase) {
    return {
      commissionPercentage: 0,
      fixedFee: 25000,
      notes: "Demo platform commission.",
    };
  }

  const settings = await prisma.companyBillingSettings.findUnique({
    where: { companyId },
    select: {
      notes: true,
      defaultCommissionRule: {
        select: {
          feeType: true,
          flatAmount: true,
          percentageRate: true,
          notes: true,
        },
      },
    },
  });

  return {
    commissionPercentage:
      settings?.defaultCommissionRule?.feeType === "PERCENTAGE"
        ? decimalToNumber(settings.defaultCommissionRule.percentageRate) ?? 0
        : 0,
    fixedFee:
      settings?.defaultCommissionRule?.feeType === "FLAT"
        ? decimalToNumber(settings.defaultCommissionRule.flatAmount) ?? 0
        : 0,
    notes: settings?.defaultCommissionRule?.notes ?? settings?.notes ?? "",
  };
}

export async function getSafePlatformCommissionControl(companyId: string) {
  try {
    return await getPlatformCommissionControl(companyId);
  } catch (error) {
    logError("Superadmin company commission lookup failed; using empty state.", {
      route: `/superadmin/companies/${companyId}`,
      component: "SuperadminCompanyOverviewPage",
      queryName: "platformCommissionControl",
      companyId,
      ...buildSafeErrorLogContext(error),
    });
    return buildDefaultPlatformCommissionControl();
  }
}

export async function updatePlatformCommissionFromSuperadmin(
  context: TenantContext,
  input: {
    companyId: string;
    commissionPercentage?: number | null;
    fixedFee?: number | null;
    notes?: string | null;
  },
) {
  if (!canManagePlatformCommission(context)) {
    throw new Error("Superadmin access is required to manage platform commission.");
  }

  if (!featureFlags.hasDatabase) {
    return { id: "demo-platform-commission-rule" };
  }

  const percentage = Math.max(0, input.commissionPercentage ?? 0);
  const fixedFee = Math.max(0, input.fixedFee ?? 0);
  const usePercentage = percentage > 0;
  const feeType = usePercentage ? "PERCENTAGE" : "FLAT";

  const rule = await prisma.commissionRule.upsert({
    where: {
      companyId_code: {
        companyId: input.companyId,
        code: PLATFORM_COMMISSION_CODE,
      },
    },
    update: {
      name: "Superadmin platform commission",
      feeType,
      flatAmount: usePercentage ? null : new Prisma.Decimal(fixedFee),
      percentageRate: usePercentage ? new Prisma.Decimal(percentage) : null,
      currency: "NGN",
      isActive: true,
      notes: input.notes ?? null,
    },
    create: {
      companyId: input.companyId,
      code: PLATFORM_COMMISSION_CODE,
      name: "Superadmin platform commission",
      feeType,
      flatAmount: usePercentage ? null : new Prisma.Decimal(fixedFee),
      percentageRate: usePercentage ? new Prisma.Decimal(percentage) : null,
      currency: "NGN",
      isActive: true,
      notes: input.notes ?? null,
    },
    select: {
      id: true,
    },
  });

  await prisma.companyBillingSettings.upsert({
    where: { companyId: input.companyId },
    update: {
      defaultCommissionRuleId: rule.id,
      notes: input.notes ?? null,
    },
    create: {
      companyId: input.companyId,
      defaultCommissionRuleId: rule.id,
      notes: input.notes ?? null,
    },
  });

  return rule;
}
