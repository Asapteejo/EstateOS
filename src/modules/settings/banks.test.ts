import assert from "node:assert/strict";
import test from "node:test";

import { normalizeBankOptions } from "@/modules/settings/banks";

test("duplicate bank codes render with unique option keys while preserving bankCode values", () => {
  const options = normalizeBankOptions([
    { name: "Providus Bank", code: "50739" },
    { name: "Providus Bank", code: "50739" },
    { name: "Providus Mobile", code: "50739" },
  ]);

  assert.equal(options.length, 2);
  assert.deepEqual(options.map((option) => option.code), ["50739", "50739"]);
  assert.deepEqual(new Set(options.map((option) => option.optionKey)).size, 2);
});
