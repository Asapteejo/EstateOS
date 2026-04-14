import assert from "node:assert/strict";
import test from "node:test";

import { tenantSettingsSchema } from "@/lib/validations/settings";

test("tenant verification thresholds must remain ordered", () => {
  const parsed = tenantSettingsSchema.safeParse({
    companyName: "Acme Realty",
    defaultWishlistDurationDays: 14,
    verificationFreshDays: 14,
    verificationStaleDays: 10,
    verificationHideDays: 9,
    verificationWarningReminderDays: 10,
    defaultCurrency: "NGN",
    publicStaffDirectoryEnabled: true,
    showStaffEmail: true,
    showStaffWhatsApp: true,
    requireActivePlanForTransactions: true,
    requireActivePlanForAdminOps: false,
  });

  assert.equal(parsed.success, false);
});

test("tenant settings allow nullable optional brand and contact fields", () => {
  const parsed = tenantSettingsSchema.safeParse({
    companyName: "Acme Realty",
    logoUrl: null,
    supportEmail: null,
    supportPhone: null,
    whatsappNumber: null,
    address: null,
    primaryColor: null,
    accentColor: null,
    paymentDisplayLabel: null,
    receiptFooterNote: null,
    defaultWishlistDurationDays: 14,
    verificationFreshDays: 7,
    verificationStaleDays: 30,
    verificationHideDays: 45,
    verificationWarningReminderDays: 2,
    defaultCurrency: "NGN",
    publicStaffDirectoryEnabled: true,
    showStaffEmail: true,
    showStaffWhatsApp: true,
    requireActivePlanForTransactions: true,
    requireActivePlanForAdminOps: false,
  });

  assert.equal(parsed.success, true);
});
