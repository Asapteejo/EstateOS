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
]);

export const WALKTHROUGH_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;
export const WALKTHROUGH_VIDEO_MAX_SIZE_BYTES = 100 * 1024 * 1024;

export function isAllowedWalkthroughVideoMimeType(mimeType: string) {
  return WALKTHROUGH_VIDEO_MIME_TYPES.includes(mimeType as (typeof WALKTHROUGH_VIDEO_MIME_TYPES)[number]);
}

export const uploadRequestSchema = z.object({
  surface: uploadSurfaceSchema.default("portal"),
  purpose: uploadPurposeSchema,
  fileName: z.string().min(2),
  contentType: z.string().min(3),
  sizeBytes: z.coerce.number().int().positive().optional(),
}).superRefine((value, ctx) => {
  if (value.purpose !== "PROPERTY_WALKTHROUGH_VIDEO") {
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
