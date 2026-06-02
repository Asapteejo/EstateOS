import assert from "node:assert/strict";
import test from "node:test";

import { selectAuthenticatedCompany } from "@/lib/tenancy/authenticated-company";

test("authenticated tenant resolution ignores hinted and fallback companies", () => {
  assert.equal(
    selectAuthenticatedCompany({
      sessionCompany: null,
      hintedCompany: { id: "attacker-selected-company" },
      fallbackCompany: { id: "default-company" },
    }),
    null,
  );
});

test("authenticated tenant resolution accepts only persisted session company", () => {
  assert.deepEqual(
    selectAuthenticatedCompany({
      sessionCompany: { id: "member-company" },
      hintedCompany: { id: "other-company" },
      fallbackCompany: null,
    }),
    { id: "member-company" },
  );
});
