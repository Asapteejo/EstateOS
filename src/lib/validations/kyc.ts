import { z } from "zod";

export const nigeriaKycIdentityDocumentTypes = [
  "NIN",
  "PASSPORT",
  "DRIVERS_LICENSE",
  "VOTERS_CARD",
] as const;

export const globalKycIdentityDocumentTypes = [
  "NATIONAL_ID",
  "PASSPORT",
  "DRIVERS_LICENSE",
  "RESIDENCE_PERMIT",
] as const;

export const kycIdentityDocumentTypeSchema = z.enum([
  ...nigeriaKycIdentityDocumentTypes,
  ...globalKycIdentityDocumentTypes,
]);

export const buyerKycSubmissionSchema = z.object({
  documentType: z.enum(["KYC_ID", "KYC_PROOF_OF_ADDRESS", "PASSPORT_PHOTO"]).default("KYC_ID"),
  country: z.string().trim().min(2).max(80).default("Nigeria"),
  identityDocumentType: kycIdentityDocumentTypeSchema.default("NIN"),
  fileName: z.string().trim().min(2),
  storageKey: z.string().trim().min(3),
  mimeType: z.string().trim().min(3).optional(),
  sizeBytes: z.coerce.number().int().positive().max(10 * 1024 * 1024, "KYC files must be 10MB or smaller.").optional(),
  notes: z.string().trim().max(500).optional(),
}).superRefine((value, ctx) => {
  const allowedMimeTypes = new Set([
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ]);

  if (value.mimeType && !allowedMimeTypes.has(value.mimeType.toLowerCase())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "KYC documents must be PDF, JPG, PNG, or WEBP files.",
      path: ["mimeType"],
    });
  }

  if (
    value.country.trim().toLowerCase() === "nigeria" &&
    !nigeriaKycIdentityDocumentTypes.includes(
      value.identityDocumentType as (typeof nigeriaKycIdentityDocumentTypes)[number],
    )
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Choose a supported Nigerian identity document type.",
      path: ["identityDocumentType"],
    });
  }
});

export const adminKycReviewSchema = z.object({
  status: z.enum([
    "UNDER_REVIEW",
    "APPROVED",
    "REJECTED",
    "CHANGES_REQUESTED",
  ]),
  notes: z.string().trim().max(500).optional(),
  rejectionReason: z.string().trim().max(500).optional(),
  requiredActions: z.string().trim().max(1000).optional(),
});

export type BuyerKycSubmissionInput = z.infer<typeof buyerKycSubmissionSchema>;
export type AdminKycReviewInput = z.infer<typeof adminKycReviewSchema>;
