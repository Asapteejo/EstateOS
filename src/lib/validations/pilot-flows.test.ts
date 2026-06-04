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

test("property create schema accepts admin form payload without caller company id", () => {
  const parsed = propertyCreateSchema.safeParse({
    title: "Blueprint Urban Residences",
    shortDescription: "Modern serviced apartments with flexible ownership options.",
    description:
      "A tenant-created listing with enough public copy, location data, and pricing details to pass the admin property creation contract.",
    propertyType: "APARTMENT",
    status: "AVAILABLE",
    isFeatured: true,
    priceFrom: 85000000,
    priceTo: "",
    currency: "NGN",
    bedrooms: 2,
    bathrooms: 2,
    parkingSpaces: 1,
    sizeSqm: 95,
    landmarks: ["Lekki Phase 1", "Admiralty Way"],
    hasPaymentPlan: false,
    wishlistDurationDays: 14,
    wishlistReminderEnabled: true,
    location: {
      addressLine1: "12 Admiralty Way",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
    features: [],
    media: [],
    units: [],
    paymentPlans: [],
  });

  assert.equal(parsed.success, true);
  if (!parsed.success) {
    assert.fail("Expected property payload to parse.");
  }
  assert.equal("companyId" in parsed.data, false);
  assert.equal(parsed.data.priceTo, undefined);
});

test("property create schema requires starting price and validates optional max price", () => {
  const missingPrice = propertyCreateSchema.safeParse({
    title: "Blueprint Urban Residences",
    shortDescription: "Modern serviced apartments with flexible ownership options.",
    description:
      "A tenant-created listing with enough public copy, location data, and pricing details to pass the admin property creation contract.",
    propertyType: "APARTMENT",
    status: "AVAILABLE",
    priceFrom: "",
    priceTo: "",
    location: {
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
  });

  assert.equal(missingPrice.success, false);
  if (missingPrice.success) {
    assert.fail("Expected missing starting price to fail.");
  }
  assert.equal(missingPrice.error.issues.some((issue) => issue.path.join(".") === "priceFrom"), true);

  const invalidRange = propertyCreateSchema.safeParse({
    title: "Blueprint Urban Residences",
    shortDescription: "Modern serviced apartments with flexible ownership options.",
    description:
      "A tenant-created listing with enough public copy, location data, and pricing details to pass the admin property creation contract.",
    propertyType: "APARTMENT",
    status: "AVAILABLE",
    priceFrom: 85000000,
    priceTo: 80000000,
    location: {
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
  });

  assert.equal(invalidRange.success, false);
  if (invalidRange.success) {
    assert.fail("Expected max price lower than starting price to fail.");
  }
  assert.equal(invalidRange.error.issues.some((issue) => issue.path.join(".") === "priceTo"), true);
});

test("property create schema parses formatted global prices", () => {
  const commaFormatted = propertyCreateSchema.safeParse({
    title: "Global Price Listing",
    shortDescription: "Property with formatted numeric price input.",
    description:
      "A listing payload where the admin enters comma separated price values and the backend stores clean numeric pricing.",
    propertyType: "APARTMENT",
    status: "AVAILABLE",
    priceFrom: "25,000,000",
    priceTo: "",
    currency: "NGN",
    location: {
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
  });

  assert.equal(commaFormatted.success, true);
  if (!commaFormatted.success) {
    assert.fail("Expected comma-formatted price to parse.");
  }
  assert.equal(commaFormatted.data.priceFrom, 25000000);
  assert.equal(commaFormatted.data.priceTo, undefined);

  const symbolFormatted = propertyCreateSchema.safeParse({
    title: "Dollar Price Listing",
    shortDescription: "Property with currency symbol price input.",
    description:
      "A listing payload where the admin enters a symbol-prefixed price and an international currency code.",
    propertyType: "COMMERCIAL",
    status: "AVAILABLE",
    priceFrom: "$120,000",
    currency: "USD",
    location: {
      city: "Accra",
      state: "Greater Accra",
      country: "Ghana",
    },
  });

  assert.equal(symbolFormatted.success, true);
  if (!symbolFormatted.success) {
    assert.fail("Expected symbol-formatted price to parse.");
  }
  assert.equal(symbolFormatted.data.priceFrom, 120000);
  assert.equal(symbolFormatted.data.currency, "USD");
});

test("property create schema rejects missing required fields with issue paths", () => {
  const parsed = propertyCreateSchema.safeParse({
    title: "",
    shortDescription: "",
    description: "",
    propertyType: "APARTMENT",
    priceFrom: 0,
    companyId: "caller-company",
    location: {
      city: "",
      state: "",
      country: "Nigeria",
    },
  });

  assert.equal(parsed.success, false);
  if (parsed.success) {
    assert.fail("Expected invalid property payload to fail.");
  }
  assert.equal(parsed.error.issues.some((issue) => issue.path.join(".") === "title"), true);
  assert.equal(parsed.error.issues.some((issue) => issue.path.join(".") === "shortDescription"), true);
  assert.equal(parsed.error.issues.some((issue) => issue.path.join(".") === "description"), true);
  assert.equal(parsed.error.issues.some((issue) => issue.path.join(".") === "priceFrom"), true);
  assert.equal(parsed.error.issues.some((issue) => issue.message.includes("companyId")), true);
});

test("land property can omit building fields and include plot options", () => {
  const parsed = propertyCreateSchema.safeParse({
    title: "Ibeju Lakefront Plots",
    shortDescription: "Flexible land allocation with multiple plot sizes.",
    description:
      "A land listing for buyers selecting plot sizes, allocation quantities, and flexible land banking options without apartment-specific bedroom or bathroom fields.",
    propertyType: "LAND",
    status: "AVAILABLE",
    priceFrom: 25000000,
    priceTo: "",
    landSaleUnit: "PLOT",
    landSizeSqm: "600",
    numberOfPlots: "2",
    plotOptions: [
      { label: "350 sqm", unit: "SQM", sizeSqm: "350", price: "₦18,000,000", currency: "NGN", status: "AVAILABLE" },
      { label: "1 plot", unit: "PLOT", numberOfPlots: "1", price: "25000000", currency: "NGN", status: "AVAILABLE" },
    ],
    location: {
      city: "Ibeju-Lekki",
      state: "Lagos",
      country: "Nigeria",
    },
  });

  assert.equal(parsed.success, true);
  if (!parsed.success) {
    assert.fail("Expected land property payload to parse.");
  }
  assert.equal(parsed.data.bedrooms, undefined);
  assert.equal(parsed.data.bathrooms, undefined);
  assert.equal(parsed.data.landSaleUnit, "PLOT");
  assert.equal(parsed.data.plotOptions.length, 2);
  assert.equal(parsed.data.plotOptions[0].sizeSqm, 350);
  assert.equal(parsed.data.plotOptions[0].price, 18000000);
});

test("land property supports hectare unit and flexible option currencies", () => {
  const parsed = propertyCreateSchema.safeParse({
    title: "Diaspora Agricultural Estate",
    shortDescription: "Large land allocation sold by hectare with optional custom parcel choices.",
    description:
      "A global land listing that can be sold by hectares and still publish flexible parcel options with their own currencies.",
    propertyType: "LAND",
    status: "AVAILABLE",
    priceFrom: "$250,000",
    currency: "USD",
    landSaleUnit: "HECTARE",
    hectares: "2",
    plotOptions: [
      { label: "2 hectares", unit: "HECTARE", hectares: "2", price: "$250,000", currency: "USD" },
      { label: "Corner piece", unit: "CUSTOM", note: "Price on request" },
    ],
    location: {
      city: "Kumasi",
      state: "Ashanti",
      country: "Ghana",
    },
  });

  assert.equal(parsed.success, true);
  if (!parsed.success) {
    assert.fail("Expected hectare land payload to parse.");
  }
  assert.equal(parsed.data.hectares, 2);
  assert.equal(parsed.data.plotOptions[0].price, 250000);
  assert.equal(parsed.data.plotOptions[0].currency, "USD");
});

test("land property supports multiple SQM options with optional prices", () => {
  const parsed = propertyCreateSchema.safeParse({
    title: "Ibeju Flexible SQM Lots",
    shortDescription: "Land listing with multiple square-meter options.",
    description:
      "A land listing where buyers can choose from multiple square-meter allocations under one public property record.",
    propertyType: "LAND",
    status: "AVAILABLE",
    priceFrom: "18,000,000",
    currency: "NGN",
    landSaleUnit: "SQM",
    landSizeSqm: "",
    plotOptions: [
      { unit: "SQM", label: "350 sqm", sizeSqm: "350", price: "₦18,000,000", currency: "NGN" },
      { unit: "SQM", label: "400 sqm", sizeSqm: "400", price: "", currency: "NGN" },
      { unit: "SQM", sizeSqm: "600", currency: "NGN", status: "AVAILABLE" },
    ],
    location: {
      city: "Ibeju-Lekki",
      state: "Lagos",
      country: "Nigeria",
    },
  });

  assert.equal(parsed.success, true);
  if (!parsed.success) {
    assert.fail("Expected multiple SQM land options to parse.");
  }
  assert.equal(parsed.data.landSizeSqm, undefined);
  assert.equal(parsed.data.plotOptions.length, 3);
  assert.equal(parsed.data.plotOptions[0].sizeSqm, 350);
  assert.equal(parsed.data.plotOptions[1].price, undefined);
  assert.equal(parsed.data.plotOptions[2].sizeSqm, 600);
});

test("land SQM option requires positive size when a row is added", () => {
  const parsed = propertyCreateSchema.safeParse({
    title: "Invalid SQM Lots",
    shortDescription: "Land listing with invalid square-meter option.",
    description:
      "A land listing payload that should fail because an added SQM option row has no positive size.",
    propertyType: "LAND",
    status: "AVAILABLE",
    priceFrom: "18,000,000",
    currency: "NGN",
    landSaleUnit: "SQM",
    plotOptions: [
      { unit: "SQM", label: "Invalid row", sizeSqm: "0", price: "" },
    ],
    location: {
      city: "Ibeju-Lekki",
      state: "Lagos",
      country: "Nigeria",
    },
  });

  assert.equal(parsed.success, false);
  if (parsed.success) {
    assert.fail("Expected invalid SQM option to fail.");
  }
  assert.equal(parsed.error.issues.some((issue) => issue.path.join(".") === "plotOptions.0.sizeSqm"), true);
});

test("empty optional numeric fields stay undefined instead of becoming zero", () => {
  const parsed = propertyCreateSchema.safeParse({
    title: "Lekki Studio Residences",
    shortDescription: "Compact apartments with optional detailed metrics.",
    description:
      "A residential property where optional numeric fields can be left blank without becoming zero-valued listing attributes.",
    propertyType: "APARTMENT",
    status: "DRAFT",
    priceFrom: 45000000,
    bedrooms: "",
    bathrooms: " ",
    sizeSqm: "",
    location: {
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
      latitude: "",
      longitude: " ",
    },
  });

  assert.equal(parsed.success, true);
  if (!parsed.success) {
    assert.fail("Expected optional empty numeric fields to parse.");
  }
  assert.equal(parsed.data.bedrooms, undefined);
  assert.equal(parsed.data.bathrooms, undefined);
  assert.equal(parsed.data.sizeSqm, undefined);
  assert.equal(parsed.data.location.latitude, undefined);
  assert.equal(parsed.data.location.longitude, undefined);
});

test("property location accepts Mapbox address metadata with complete coordinates", () => {
  const parsed = propertyCreateSchema.safeParse({
    title: "Mapbox Ready Residences",
    shortDescription: "A listing with geocoded address metadata.",
    description:
      "A residential listing that stores formatted address, Mapbox place id, and exact coordinates for public map display.",
    propertyType: "APARTMENT",
    status: "DRAFT",
    priceFrom: 85000000,
    location: {
      addressLine1: "10 Admiralty Way",
      formattedAddress: "10 Admiralty Way, Lekki Phase 1, Lagos, Nigeria",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
      latitude: "6.4474000",
      longitude: "3.4723000",
      mapboxPlaceId: "dXJuOm1ieHBsYzp0ZXN0",
      boundaryGeoJson: {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [[
            [3.4723, 6.4474],
            [3.4733, 6.4474],
            [3.4733, 6.4484],
            [3.4723, 6.4474],
          ]],
        },
        properties: {},
      },
    },
  });

  assert.equal(parsed.success, true);
  if (!parsed.success) {
    assert.fail("Expected Mapbox location metadata to parse.");
  }
  assert.equal(parsed.data.location.formattedAddress, "10 Admiralty Way, Lekki Phase 1, Lagos, Nigeria");
  assert.equal(parsed.data.location.mapboxPlaceId, "dXJuOm1ieHBsYzp0ZXN0");
  assert.equal((parsed.data.location.boundaryGeoJson as { type?: string }).type, "Feature");
  assert.equal(parsed.data.location.latitude, 6.4474);
  assert.equal(parsed.data.location.longitude, 3.4723);
});

test("property location rejects partial coordinates", () => {
  const parsed = propertyCreateSchema.safeParse({
    title: "Partial Coordinate Estate",
    shortDescription: "A listing missing one coordinate.",
    description:
      "A residential listing that should not save partial map coordinates because public map rendering needs a complete pair.",
    propertyType: "APARTMENT",
    status: "DRAFT",
    priceFrom: 85000000,
    location: {
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
      latitude: "6.4474000",
      longitude: "",
    },
  });

  assert.equal(parsed.success, false);
  if (parsed.success) {
    assert.fail("Expected partial coordinates to fail.");
  }
  assert.equal(parsed.error.issues.some((issue) => issue.path.join(".") === "location.longitude"), true);
});

test("countdown data validates when enabled and rejects missing deadline", () => {
  const valid = propertyCreateSchema.safeParse({
    title: "Ikoyi Intro Offer",
    shortDescription: "Launch pricing with a visible countdown timer.",
    description:
      "A residential listing that uses an optional future countdown to communicate launch pricing urgency without making the deadline compulsory.",
    propertyType: "APARTMENT",
    status: "AVAILABLE",
    priceFrom: 125000000,
    offerEndsAt: "2026-05-10T12:00:00.000Z",
    countdownLabel: "Introductory price ends in",
    countdownEnabled: true,
    location: {
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
  });

  assert.equal(valid.success, true);

  const invalid = propertyCreateSchema.safeParse({
    title: "Ikoyi Intro Offer",
    shortDescription: "Launch pricing with a visible countdown timer.",
    description:
      "A residential listing that uses an optional future countdown to communicate launch pricing urgency without making the deadline compulsory.",
    propertyType: "APARTMENT",
    status: "AVAILABLE",
    priceFrom: 125000000,
    countdownEnabled: true,
    location: {
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
  });

  assert.equal(invalid.success, false);
  if (invalid.success) {
    assert.fail("Expected missing countdown deadline to fail.");
  }
  assert.equal(invalid.error.issues.some((issue) => issue.path.join(".") === "offerEndsAt"), true);
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
      country: "Nigeria",
      identityDocumentType: "NIN",
      fileName: "passport.pdf",
      storageKey: "acme-realty/kyc/test-passport.pdf",
      mimeType: "application/pdf",
    }).success,
    true,
  );

  assert.equal(
    buyerKycSubmissionSchema.safeParse({
      documentType: "KYC_ID",
      country: "Ghana",
      identityDocumentType: "NATIONAL_ID",
      fileName: "national-id.png",
      storageKey: "acme-realty/kyc/test-national-id.png",
      mimeType: "image/png",
    }).success,
    true,
  );

  assert.equal(
    buyerKycSubmissionSchema.safeParse({
      documentType: "KYC_ID",
      country: "Nigeria",
      identityDocumentType: "TAX_ID",
      fileName: "tax.pdf",
      storageKey: "acme-realty/kyc/test-tax.pdf",
      mimeType: "application/pdf",
    }).success,
    false,
  );

  assert.equal(
    buyerKycSubmissionSchema.safeParse({
      country: "Nigeria",
      identityDocumentType: "CAC_BUSINESS_DOC",
      fileName: "cac.pdf",
      storageKey: "acme-realty/kyc/test-cac.pdf",
      mimeType: "application/pdf",
    }).success,
    false,
  );

  assert.equal(
    adminKycReviewSchema.safeParse({
      status: "REJECTED",
      rejectionReason: "Document is blurry.",
      requiredActions: "Upload a clearer NIN slip.",
    }).success,
    true,
  );
});
