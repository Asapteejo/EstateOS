import assert from "node:assert/strict";
import test from "node:test";

import { buildTenantPaymentProviderAccountWhere } from "@/modules/settings/payment-account";

test("tenant payment account lookup is always scoped to the current company", () => {
  assert.deepEqual(buildTenantPaymentProviderAccountWhere("company_current"), {
    companyId: "company_current",
    provider: "PAYSTACK",
  });
});
