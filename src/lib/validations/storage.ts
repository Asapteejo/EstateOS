import { z } from "zod";

export const uploadSurfaceSchema = z.enum(["admin", "portal"]);
export const uploadPurposeSchema = z.enum([
  "BRAND_LOGO",
  "BRAND_FAVICON",
  "BRAND_HERO",
  "STAFF_PHOTO",
  "RESUME",
  "PROPERTY_MEDIA",
  "BROCHURE",
  "KYC_DOCUMENT",
]);

export const uploadRequestSchema = z.object({
  surface: uploadSurfaceSchema.default("portal"),
  purpose: uploadPurposeSchema,
  fileName: z.string().min(2),
  contentType: z.string().min(3),
});

export const completeUploadSchema = z.object({
  surface: uploadSurfaceSchema.default("portal"),
  purpose: uploadPurposeSchema,
  fileName: z.string().trim().min(2),
  storageKey: z.string().trim().min(3),
  mimeType: z.string().trim().min(3).optional(),
  sizeBytes: z.coerce.number().int().positive().optional(),
});
