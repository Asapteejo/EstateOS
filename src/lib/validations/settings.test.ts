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
