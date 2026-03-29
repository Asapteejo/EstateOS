import test from "node:test";
import assert from "node:assert/strict";

import {
  propertyCreateSchema,
  propertyStatusUpdateSchema,
} from "@/lib/validations/properties";
import { buyerProfileSchema } from "@/lib/validations/profile";
import { adminKycReviewSchema, buyerKycSubmissionSchema } from "@/lib/validations/kyc";

test("property create schema accepts nested units and media required for admin CRUD", () => {
  const parsed = propertyCreateSchema.safeParse({
    title: "Admiralty Crest",
    shortDescription: "Premium mixed-use development in Lekki with phased release inventory.",
    description:
      "A pilot-ready property record with public media, unit inventory, brochure linkage, and precise location data for marketing and back-office operations.",
    propertyType: "APARTMENT",
    status: "DRAFT",
    priceFrom: 120000000,
    location: {
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
    media: [
      {
        url: "https://example.com/property.jpg",
        sortOrder: 0,
        isPrimary: true,
        visibility: "PUBLIC",
      },
    ],
    units: [
      {
        unitCode: "A-01",
        title: "2 Bedroom",
        status: "AVAILABLE",
        price: 120000000,
      },
    ],
  });

  assert.equal(parsed.success, true);
  assert.equal(propertyStatusUpdateSchema.parse({ status: "AVAILABLE" }).status, "AVAILABLE");
});

test("buyer profile and KYC schemas enforce pilot-critical onboarding fields", () => {
  assert.equal(
    buyerProfileSchema.safeParse({
      firstName: "Ada",
      lastName: "Okafor",
      email: "buyer@acmerealty.dev",
      phone: "+2348010001111",
      nationality: "Nigerian",
      addressLine1: "12 Admiralty Way",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
      occupation: "Product Manager",
      nextOfKinName: "Chika Okafor",
      nextOfKinPhone: "+2348010002222",
    }).success,
    true,
  );

  assert.equal(
    buyerKycSubmissionSchema.safeParse({
      documentType: "KYC_ID",
      fileName: "passport.pdf",
      storageKey: "acme-realty/kyc/test-passport.pdf",
    }).success,
    true,
  );

  assert.equal(adminKycReviewSchema.safeParse({ status: "APPROVED" }).success, true);
});
