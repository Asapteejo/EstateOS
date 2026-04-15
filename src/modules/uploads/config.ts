import type { DocumentType, DocumentVisibility } from "@prisma/client";

export type UploadPurpose =
  | "BRAND_LOGO"
  | "BRAND_FAVICON"
  | "BRAND_HERO"
  | "STAFF_PHOTO"
  | "RESUME"
  | "PROPERTY_MEDIA"
  | "BROCHURE"
  | "KYC_DOCUMENT"
  | "CONTRACT_DOCUMENT";

export type UploadPurposeConfig = {
  domain: string;
  visibility: DocumentVisibility;
  isPublicAsset: boolean;
  documentType?: DocumentType;
  accept: string;
  label: string;
};

const uploadPurposeConfig: Record<UploadPurpose, UploadPurposeConfig> = {
  BRAND_LOGO: {
    domain: "branding",
    visibility: "PUBLIC",
    isPublicAsset: true,
    accept: "image/*",
    label: "Brand logo",
  },
  BRAND_FAVICON: {
    domain: "branding",
    visibility: "PUBLIC",
    isPublicAsset: true,
    accept: "image/*,.ico",
    label: "Favicon",
  },
  BRAND_HERO: {
    domain: "branding",
    visibility: "PUBLIC",
    isPublicAsset: true,
    accept: "image/*",
    label: "Hero image",
  },
  STAFF_PHOTO: {
    domain: "staff-media",
    visibility: "PUBLIC",
    isPublicAsset: true,
    accept: "image/*",
    label: "Staff photo",
  },
  RESUME: {
    domain: "staff-documents",
    visibility: "PRIVATE",
    isPublicAsset: false,
    documentType: "OTHER",
    accept: ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    label: "Resume",
  },
  PROPERTY_MEDIA: {
    domain: "property-media",
    visibility: "PUBLIC",
    isPublicAsset: true,
    accept: "image/*,video/*",
    label: "Property media",
  },
  BROCHURE: {
    domain: "brochures",
    visibility: "PUBLIC",
    isPublicAsset: false,
    documentType: "BROCHURE",
    accept: ".pdf,application/pdf",
    label: "Brochure",
  },
  KYC_DOCUMENT: {
    domain: "kyc",
    visibility: "PRIVATE",
    isPublicAsset: false,
    documentType: "OTHER",
    accept: ".pdf,image/*,application/pdf",
    label: "KYC document",
  },
  CONTRACT_DOCUMENT: {
    domain: "contracts",
    visibility: "PRIVATE",
    isPublicAsset: false,
    documentType: "CONTRACT",
    accept: ".pdf,application/pdf",
    label: "Contract document",
  },
};

export const uploadPurposeOptions = Object.entries(uploadPurposeConfig).map(([value, config]) => ({
  value: value as UploadPurpose,
  label: config.label,
}));

const publicDomains = new Set(
  Object.values(uploadPurposeConfig)
    .filter((item) => item.isPublicAsset)
    .map((item) => item.domain),
);

export function getUploadPurposeConfig(purpose: UploadPurpose): UploadPurposeConfig {
  return uploadPurposeConfig[purpose];
}

export function isPublicStorageDomain(domain: string) {
  return publicDomains.has(domain);
}
