import { z } from "zod";

export const uploadSurfaceSchema = z.enum(["admin", "portal"]);
export const uploadPurposeSchema = z.enum([
  "BRAND_LOGO",
  "BRAND_FAVICON",
  "BRAND_HERO",
  "BUYER_PROFILE_PHOTO",
  "STAFF_PHOTO",
  "RESUME",
  "PROPERTY_MEDIA",
  "PROPERTY_WALKTHROUGH_VIDEO",
  "BROCHURE",
  "KYC_DOCUMENT",
  "CONTRACT_DOCUMENT",
  "COMPANY_STAMP",
  "COMPANY_SIGNATURE",
]);

export const WALKTHROUGH_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;
export const WALKTHROUGH_VIDEO_MAX_SIZE_BYTES = 100 * 1024 * 1024;
export const KYC_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;
export const KYC_DOCUMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const CONTRACT_ASSET_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;
export const CONTRACT_ASSET_MAX_SIZE_BYTES = 5 * 1024 * 1024;

export function isAllowedWalkthroughVideoMimeType(mimeType: string) {
  return WALKTHROUGH_VIDEO_MIME_TYPES.includes(mimeType as (typeof WALKTHROUGH_VIDEO_MIME_TYPES)[number]);
}

export function isAllowedKycDocumentMimeType(mimeType: string) {
  return KYC_DOCUMENT_MIME_TYPES.includes(mimeType.toLowerCase() as (typeof KYC_DOCUMENT_MIME_TYPES)[number]);
}

export function isAllowedContractAssetMimeType(mimeType: string) {
  return CONTRACT_ASSET_IMAGE_MIME_TYPES.includes(
    mimeType.toLowerCase() as (typeof CONTRACT_ASSET_IMAGE_MIME_TYPES)[number],
  );
}

function validateContractAssetImage(
  value: { purpose: string; contentType?: string; mimeType?: string; sizeBytes?: number },
  ctx: z.RefinementCtx,
  path: "contentType" | "mimeType",
) {
  if (value.purpose !== "COMPANY_STAMP" && value.purpose !== "COMPANY_SIGNATURE") {
    return false;
  }

  const mimeType = path === "contentType" ? value.contentType : value.mimeType;
  if (!mimeType || !isAllowedContractAssetMimeType(mimeType)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Contract stamp and signature uploads must be PNG, JPG, or WEBP images.",
      path: [path],
    });
  }

  if (value.sizeBytes != null && value.sizeBytes > CONTRACT_ASSET_MAX_SIZE_BYTES) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Contract stamp and signature uploads must be 5MB or smaller.",
      path: ["sizeBytes"],
    });
  }

  return true;
}

export const uploadRequestSchema = z.object({
  surface: uploadSurfaceSchema.default("portal"),
  purpose: uploadPurposeSchema,
  fileName: z.string().min(2),
  contentType: z.string().min(3),
  sizeBytes: z.coerce.number().int().positive().optional(),
}).superRefine((value, ctx) => {
  if (value.purpose !== "PROPERTY_WALKTHROUGH_VIDEO") {
    if (validateContractAssetImage(value, ctx, "contentType")) {
      return;
    }

    if (value.purpose === "KYC_DOCUMENT") {
      if (!isAllowedKycDocumentMimeType(value.contentType)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "KYC documents must be PDF, JPG, PNG, or WEBP files.",
          path: ["contentType"],
        });
      }

      if (value.sizeBytes != null && value.sizeBytes > KYC_DOCUMENT_MAX_SIZE_BYTES) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "KYC documents must be 10MB or smaller.",
          path: ["sizeBytes"],
        });
      }
    }
    return;
  }

  if (!isAllowedWalkthroughVideoMimeType(value.contentType)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Walkthrough videos must be MP4, WebM, or MOV files.",
      path: ["contentType"],
    });
  }

  if (value.sizeBytes != null && value.sizeBytes > WALKTHROUGH_VIDEO_MAX_SIZE_BYTES) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Walkthrough videos must be 100MB or smaller.",
      path: ["sizeBytes"],
    });
  }
});

export const completeUploadSchema = z.object({
  surface: uploadSurfaceSchema.default("portal"),
  purpose: uploadPurposeSchema,
  fileName: z.string().trim().min(2),
  storageKey: z.string().trim().min(3),
  mimeType: z.string().trim().min(3).optional(),
  sizeBytes: z.coerce.number().int().positive().optional(),
}).superRefine((value, ctx) => {
  if (value.purpose !== "PROPERTY_WALKTHROUGH_VIDEO") {
    if (validateContractAssetImage(value, ctx, "mimeType")) {
      return;
    }

    if (value.purpose === "KYC_DOCUMENT") {
      if (!value.mimeType || !isAllowedKycDocumentMimeType(value.mimeType)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "KYC documents must be PDF, JPG, PNG, or WEBP files.",
          path: ["mimeType"],
        });
      }

      if (value.sizeBytes != null && value.sizeBytes > KYC_DOCUMENT_MAX_SIZE_BYTES) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "KYC documents must be 10MB or smaller.",
          path: ["sizeBytes"],
        });
      }
    }
    return;
  }

  if (!value.mimeType || !isAllowedWalkthroughVideoMimeType(value.mimeType)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Walkthrough videos must be MP4, WebM, or MOV files.",
      path: ["mimeType"],
    });
  }

  if (value.sizeBytes != null && value.sizeBytes > WALKTHROUGH_VIDEO_MAX_SIZE_BYTES) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Walkthrough videos must be 100MB or smaller.",
      path: ["sizeBytes"],
    });
  }
});
