import assert from "node:assert/strict";
import test from "node:test";
import { shouldRedirectBuyerToProfileSetup } from "@/modules/portal/profile-access";

test("buyers missing a profile are sent to profile setup", () => {
  assert.equal(
    shouldRedirectBuyerToProfileSetup({ roles: ["BUYER"], profileExists: false }),
    true,
  );
  assert.equal(
    shouldRedirectBuyerToProfileSetup({ roles: ["BUYER"], profileExists: true }),
    false,
  );
});

test("non-buyer operators are not sent through buyer profile setup", () => {
  assert.equal(
    shouldRedirectBuyerToProfileSetup({ roles: ["ADMIN"], profileExists: false }),
    false,
  );
});

