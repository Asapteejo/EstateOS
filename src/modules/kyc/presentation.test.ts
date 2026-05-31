import assert from "node:assert/strict";
import test from "node:test";

import {
  getAcceptedBuyerIdentityDocuments,
  getBuyerProfileKycChecklist,
  getKycDocumentFormatMessage,
  globalBuyerIdentityDocuments,
  isBuyerProfileReadyForKyc,
  nigeriaBuyerIdentityDocuments,
} from "@/modules/kyc/presentation";

test("buyer-facing KYC document options exclude business registration for individuals", () => {
  const nigeriaValues = nigeriaBuyerIdentityDocuments.map(([value]) => value);
  const globalValues = globalBuyerIdentityDocuments.map(([value]) => value);

  assert.deepEqual(nigeriaValues, ["NIN", "PASSPORT", "DRIVERS_LICENSE", "VOTERS_CARD"]);
  assert.deepEqual(globalValues, ["NATIONAL_ID", "PASSPORT", "DRIVERS_LICENSE", "RESIDENCE_PERMIT"]);
  assert.equal((nigeriaValues as readonly string[]).includes("CAC_BUSINESS_DOC"), false);
  assert.equal((globalValues as readonly string[]).includes("BUSINESS_REGISTRATION"), false);
});

test("accepted KYC documents are country-aware", () => {
  assert.deepEqual(
    getAcceptedBuyerIdentityDocuments("Nigeria").map(([, label]) => label),
    ["NIN slip/card", "International Passport", "Driver's License", "Voter's Card"],
  );
  assert.deepEqual(
    getAcceptedBuyerIdentityDocuments("Ghana").map(([, label]) => label),
    ["National ID", "International Passport", "Driver's License", "Residence Permit"],
  );
});

test("minimal buyer profile checklist controls KYC readiness", () => {
  const incomplete = getBuyerProfileKycChecklist({
    firstName: "Ada",
    lastName: "Okafor",
    email: "ada@example.com",
    phone: "",
    country: "Nigeria",
    city: "Lagos",
    state: "Lagos",
  });

  assert.equal(incomplete.some((item) => item.label === "Phone" && !item.complete), true);
  assert.equal(isBuyerProfileReadyForKyc(null), false);
  assert.equal(isBuyerProfileReadyForKyc({
    firstName: "Ada",
    lastName: "Okafor",
    email: "ada@example.com",
    phone: "+2348010001111",
    country: "Nigeria",
    addressLine1: "12 Admiralty Way",
  }), true);
});

test("unsupported existing KYC documents get a replace prompt", () => {
  assert.equal(getKycDocumentFormatMessage("application/pdf"), null);
  assert.equal(
    getKycDocumentFormatMessage("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    "Unsupported document format. Please replace this document.",
  );
});
