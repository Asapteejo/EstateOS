import { Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { logInfo } from "@/lib/ops/logger";
import type { TenantContext } from "@/lib/tenancy/context";
import { rejectUnsafeCompanyIdInput } from "@/lib/tenancy/db";
import type { TenantSettingsInput } from "@/lib/validations/settings";

type MarketingConfigShape = {
  propertyDefaults?: {
    defaultWishlistDurationDays?: number;
  };
  verificationRules?: {
    freshDays?: number;
    staleDays?: number;
    hideDays?: number;
    warningReminderDays?: number;
  };
  paymentDefaults?: {
    displayLabel?: string;
    receiptFooterNote?: string;
  };
  staffDefaults?: {
    publicDirectoryEnabled?: boolean;
    showEmail?: boolean;
    showWhatsApp?: boolean;
  };
};

type SocialLinksShape = {
  whatsapp?: string;
};

export type TenantAdminSettings = {
  companyName: string;
  logoUrl: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  whatsappNumber: string | null;
  address: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  defaultWishlistDurationDays: number;
  verificationFreshDays: number;
  verificationStaleDays: number;
  verificationHideDays: number;
  verificationWarningReminderDays: number;
  defaultCurrency: string;
  paymentDisplayLabel: string | null;
  receiptFooterNote: string | null;
  publicStaffDirectoryEnabled: boolean;
  showStaffEmail: boolean;
  showStaffWhatsApp: boolean;
  requireActivePlanForTransactions: boolean;
  requireActivePlanForAdminOps: boolean;
};

const defaultTenantAdminSettings: TenantAdminSettings = {
  companyName: "Acme Realty",
  logoUrl: null,
  supportEmail: null,
  supportPhone: null,
  whatsappNumber: null,
  address: null,
  primaryColor: "#0f5c4d",
  accentColor: "#b57f35",
  defaultWishlistDurationDays: 14,
  verificationFreshDays: 7,
  verificationStaleDays: 30,
  verificationHideDays: 45,
  verificationWarningReminderDays: 2,
  defaultCurrency: "NGN",
  paymentDisplayLabel: null,
  receiptFooterNote: null,
  publicStaffDirectoryEnabled: true,
  showStaffEmail: true,
  showStaffWhatsApp: true,
  requireActivePlanForTransactions: true,
  requireActivePlanForAdminOps: false,
};

function parseMarketingConfig(value: Prisma.JsonValue | null | undefined): MarketingConfigShape {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as MarketingConfigShape;
}

function parseSocialLinks(value: Prisma.JsonValue | null | undefined): SocialLinksShape {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as SocialLinksShape;
}

export async function getTenantAdminSettings(context: TenantContext): Promise<TenantAdminSettings> {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return defaultTenantAdminSettings;
  }

  const company = await prisma.company.findUnique({
    where: { id: context.companyId },
    select: {
      name: true,
      logoUrl: true,
      primaryColor: true,
      accentColor: true,
      siteSetting: {
        select: {
          companyName: true,
          supportEmail: true,
          supportPhone: true,
          address: true,
          socialLinks: true,
          marketingConfig: true,
          verificationFreshDays: true,
          verificationStaleDays: true,
          verificationHideDays: true,
          verificationWarningReminderDays: true,
        },
      },
      billingSettings: {
        select: {
          defaultCurrency: true,
          requireActivePlanForTransactions: true,
          requireActivePlanForAdminOps: true,
        },
      },
    },
  });

  if (!company) {
    return defaultTenantAdminSettings;
  }

  const marketingConfig = parseMarketingConfig(company.siteSetting?.marketingConfig);
  const socialLinks = parseSocialLinks(company.siteSetting?.socialLinks);

  return {
    companyName: company.siteSetting?.companyName ?? company.name ?? defaultTenantAdminSettings.companyName,
    logoUrl: company.logoUrl,
    supportEmail: company.siteSetting?.supportEmail ?? null,
    supportPhone: company.siteSetting?.supportPhone ?? null,
    whatsappNumber: socialLinks.whatsapp ?? null,
    address: company.siteSetting?.address ?? null,
    primaryColor: company.primaryColor ?? defaultTenantAdminSettings.primaryColor,
    accentColor: company.accentColor ?? defaultTenantAdminSettings.accentColor,
    defaultWishlistDurationDays:
      marketingConfig.propertyDefaults?.defaultWishlistDurationDays ??
      defaultTenantAdminSettings.defaultWishlistDurationDays,
    verificationFreshDays:
      company.siteSetting?.verificationFreshDays ??
      marketingConfig.verificationRules?.freshDays ??
      defaultTenantAdminSettings.verificationFreshDays,
    verificationStaleDays:
      company.siteSetting?.verificationStaleDays ??
      marketingConfig.verificationRules?.staleDays ??
      defaultTenantAdminSettings.verificationStaleDays,
    verificationHideDays:
      company.siteSetting?.verificationHideDays ??
      marketingConfig.verificationRules?.hideDays ??
      defaultTenantAdminSettings.verificationHideDays,
    verificationWarningReminderDays:
      company.siteSetting?.verificationWarningReminderDays ??
      marketingConfig.verificationRules?.warningReminderDays ??
      defaultTenantAdminSettings.verificationWarningReminderDays,
    defaultCurrency:
      company.billingSettings?.defaultCurrency ?? defaultTenantAdminSettings.defaultCurrency,
    paymentDisplayLabel:
      marketingConfig.paymentDefaults?.displayLabel ??
      defaultTenantAdminSettings.paymentDisplayLabel,
    receiptFooterNote:
      marketingConfig.paymentDefaults?.receiptFooterNote ??
      defaultTenantAdminSettings.receiptFooterNote,
    publicStaffDirectoryEnabled:
      marketingConfig.staffDefaults?.publicDirectoryEnabled ??
      defaultTenantAdminSettings.publicStaffDirectoryEnabled,
    showStaffEmail:
      marketingConfig.staffDefaults?.showEmail ?? defaultTenantAdminSettings.showStaffEmail,
    showStaffWhatsApp:
      marketingConfig.staffDefaults?.showWhatsApp ??
      defaultTenantAdminSettings.showStaffWhatsApp,
    requireActivePlanForTransactions:
      company.billingSettings?.requireActivePlanForTransactions ??
      defaultTenantAdminSettings.requireActivePlanForTransactions,
    requireActivePlanForAdminOps:
      company.billingSettings?.requireActivePlanForAdminOps ??
      defaultTenantAdminSettings.requireActivePlanForAdminOps,
  };
}

export async function getCompanyOperationalDefaults(companyId: string) {
  if (!featureFlags.hasDatabase) {
    return defaultTenantAdminSettings;
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      name: true,
      logoUrl: true,
      primaryColor: true,
      accentColor: true,
      siteSetting: {
        select: {
          companyName: true,
          supportEmail: true,
          supportPhone: true,
          address: true,
          socialLinks: true,
          marketingConfig: true,
          verificationFreshDays: true,
          verificationStaleDays: true,
          verificationHideDays: true,
          verificationWarningReminderDays: true,
        },
      },
      billingSettings: {
        select: {
          defaultCurrency: true,
          requireActivePlanForTransactions: true,
          requireActivePlanForAdminOps: true,
        },
      },
    },
  });

  if (!company) {
    return defaultTenantAdminSettings;
  }

  return getTenantAdminSettings({
    userId: null,
    companyId,
    companySlug: null,
    branchId: null,
    roles: [],
    isSuperAdmin: false,
    host: null,
    resolutionSource: "session",
  });
}

export async function updateTenantAdminSettings(
  context: TenantContext,
  rawInput: TenantSettingsInput & Record<string, unknown>,
) {
  rejectUnsafeCompanyIdInput(rawInput);

  if (!context.companyId) {
    throw new Error("Tenant context is required.");
  }

  if (!featureFlags.hasDatabase) {
    return rawInput;
  }

  const marketingConfig: MarketingConfigShape = {
    propertyDefaults: {
      defaultWishlistDurationDays: rawInput.defaultWishlistDurationDays,
    },
    verificationRules: {
      freshDays: rawInput.verificationFreshDays,
      staleDays: rawInput.verificationStaleDays,
      hideDays: rawInput.verificationHideDays,
      warningReminderDays: rawInput.verificationWarningReminderDays,
    },
    paymentDefaults: {
      displayLabel: rawInput.paymentDisplayLabel,
      receiptFooterNote: rawInput.receiptFooterNote,
    },
    staffDefaults: {
      publicDirectoryEnabled: rawInput.publicStaffDirectoryEnabled,
      showEmail: rawInput.showStaffEmail,
      showWhatsApp: rawInput.showStaffWhatsApp,
    },
  };

  const socialLinks: SocialLinksShape = {
    whatsapp: rawInput.whatsappNumber,
  };

  if (!featureFlags.isProduction) {
    logInfo("Resolving tenant settings update target.", {
      companyId: context.companyId,
      companySlug: context.companySlug,
      userId: context.userId,
      resolutionSource: context.resolutionSource,
    });
  }

  const companyRecord = await prisma.company.findUnique({
    where: { id: context.companyId },
    select: { id: true },
  });

  if (!companyRecord) {
    throw new Error("Company not found for update");
  }

  await prisma.$transaction(async (tx) => {
    await tx.company.update({
      where: { id: companyRecord.id },
      data: {
        name: rawInput.companyName,
        logoUrl: rawInput.logoUrl ?? null,
        primaryColor: rawInput.primaryColor ?? null,
        accentColor: rawInput.accentColor ?? null,
      },
    });

    await tx.siteSettings.upsert({
      where: { companyId: companyRecord.id },
      update: {
        companyName: rawInput.companyName,
        supportEmail: rawInput.supportEmail ?? null,
        supportPhone: rawInput.supportPhone ?? null,
        address: rawInput.address ?? null,
        socialLinks: socialLinks as Prisma.InputJsonValue,
        marketingConfig: marketingConfig as Prisma.InputJsonValue,
        verificationFreshDays: rawInput.verificationFreshDays,
        verificationStaleDays: rawInput.verificationStaleDays,
        verificationHideDays: rawInput.verificationHideDays,
        verificationWarningReminderDays: rawInput.verificationWarningReminderDays,
      },
      create: {
        companyId: companyRecord.id,
        companyName: rawInput.companyName,
        supportEmail: rawInput.supportEmail ?? null,
        supportPhone: rawInput.supportPhone ?? null,
        address: rawInput.address ?? null,
        socialLinks: socialLinks as Prisma.InputJsonValue,
        marketingConfig: marketingConfig as Prisma.InputJsonValue,
        verificationFreshDays: rawInput.verificationFreshDays,
        verificationStaleDays: rawInput.verificationStaleDays,
        verificationHideDays: rawInput.verificationHideDays,
        verificationWarningReminderDays: rawInput.verificationWarningReminderDays,
      },
    });

    await tx.companyBillingSettings.upsert({
      where: { companyId: companyRecord.id },
      update: {
        defaultCurrency: rawInput.defaultCurrency,
        requireActivePlanForTransactions: rawInput.requireActivePlanForTransactions,
        requireActivePlanForAdminOps: rawInput.requireActivePlanForAdminOps,
      },
      create: {
        companyId: companyRecord.id,
        defaultCurrency: rawInput.defaultCurrency,
        requireActivePlanForTransactions: rawInput.requireActivePlanForTransactions,
        requireActivePlanForAdminOps: rawInput.requireActivePlanForAdminOps,
      },
    });
  });

  await writeAuditLog({
    companyId: context.companyId,
    actorUserId: context.userId ?? undefined,
    action: "UPDATE",
    entityType: "TenantSettings",
    entityId: companyRecord.id,
    summary: "Updated tenant settings and branding",
    payload: {
      companyName: rawInput.companyName,
      defaultCurrency: rawInput.defaultCurrency,
      defaultWishlistDurationDays: rawInput.defaultWishlistDurationDays,
      verificationFreshDays: rawInput.verificationFreshDays,
      verificationStaleDays: rawInput.verificationStaleDays,
      verificationHideDays: rawInput.verificationHideDays,
    } as Prisma.InputJsonValue,
  });

  return getTenantAdminSettings(context);
}
