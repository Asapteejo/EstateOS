import { z } from "zod";

export const buyerKycSubmissionSchema = z.object({
  documentType: z.enum(["KYC_ID", "KYC_PROOF_OF_ADDRESS", "PASSPORT_PHOTO"]),
  fileName: z.string().trim().min(2),
  storageKey: z.string().trim().min(3),
  mimeType: z.string().trim().min(3).optional(),
  sizeBytes: z.coerce.number().int().positive().optional(),
  notes: z.string().trim().max(500).optional(),
});

export const adminKycReviewSchema = z.object({
  status: z.enum([
    "UNDER_REVIEW",
    "APPROVED",
    "REJECTED",
    "CHANGES_REQUESTED",
  ]),
  notes: z.string().trim().max(500).optional(),
});

export type BuyerKycSubmissionInput = z.infer<typeof buyerKycSubmissionSchema>;
export type AdminKycReviewInput = z.infer<typeof adminKycReviewSchema>;
