import { z } from "zod";

export const adminReservationStatusSchema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "EXPIRED", "CANCELLED", "CONVERTED"]),
  notes: z.string().trim().max(500).optional(),
});

export const adminTransactionStageSchema = z.object({
  stage: z.enum([
    "INQUIRY_RECEIVED",
    "KYC_SUBMITTED",
    "RESERVATION_FEE_PAID",
    "CONTRACT_ISSUED",
    "ALLOCATION_IN_PROGRESS",
    "LEGAL_VERIFICATION",
    "FINAL_PAYMENT_COMPLETED",
    "HANDOVER_COMPLETED",
  ]),
  notes: z.string().trim().max(500).optional(),
});

export type AdminReservationStatusInput = z.infer<typeof adminReservationStatusSchema>;
export type AdminTransactionStageInput = z.infer<typeof adminTransactionStageSchema>;
