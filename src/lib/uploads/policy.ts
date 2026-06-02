import type { AppRole } from "@prisma/client";

import type { UploadPurpose } from "@/modules/uploads/config";

const BUYER_UPLOAD_PURPOSES = new Set<UploadPurpose>([
  "BUYER_PROFILE_PHOTO",
  "KYC_DOCUMENT",
]);

const ADMIN_UPLOAD_PURPOSES = new Set<UploadPurpose>([
  "BRAND_LOGO",
  "BRAND_FAVICON",
  "BRAND_HERO",
  "STAFF_PHOTO",
  "RESUME",
  "PROPERTY_MEDIA",
  "PROPERTY_WALKTHROUGH_VIDEO",
  "BROCHURE",
]);

const LEGAL_UPLOAD_PURPOSES = new Set<UploadPurpose>([
  "CONTRACT_DOCUMENT",
  "COMPANY_STAMP",
  "COMPANY_SIGNATURE",
]);

export function canUploadPurpose(input: {
  roles: AppRole[];
  purpose: UploadPurpose;
}) {
  if (input.roles.includes("SUPER_ADMIN")) {
    return false;
  }

  if (BUYER_UPLOAD_PURPOSES.has(input.purpose)) {
    return input.roles.includes("BUYER");
  }

  if (LEGAL_UPLOAD_PURPOSES.has(input.purpose)) {
    return input.roles.some((role) => role === "ADMIN" || role === "LEGAL");
  }

  if (ADMIN_UPLOAD_PURPOSES.has(input.purpose)) {
    return input.roles.some((role) => role === "ADMIN" || role === "STAFF");
  }

  return false;
}

export function assertUploadPurposeAllowed(input: {
  roles: AppRole[];
  purpose: UploadPurpose;
}) {
  if (!canUploadPurpose(input)) {
    throw new Error("Upload purpose is not allowed for this account.");
  }
}
