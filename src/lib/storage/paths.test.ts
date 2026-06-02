import assert from "node:assert/strict";
import test from "node:test";

import { assertTenantStorageKey } from "@/lib/storage/paths";

test("contract asset storage validation rejects another tenant namespace", () => {
  assert.doesNotThrow(() =>
    assertTenantStorageKey(
      { companyId: "company-a", companySlug: "acme" },
      "acme/contract-assets/signature.png",
    ),
  );
  assert.throws(
    () =>
      assertTenantStorageKey(
        { companyId: "company-a", companySlug: "acme" },
        "other-tenant/contract-assets/signature.png",
      ),
    /resolved tenant/i,
  );
});
