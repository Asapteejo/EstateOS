import { z } from "zod";

export const wishlistFollowUpStatusSchema = z.enum([
  "NONE",
  "PENDING_CALL",
  "CONTACTED",
  "FOLLOW_UP_SCHEDULED",
  "CLOSED",
]);

export const savedPropertyMutationSchema = z.object({
  propertyId: z.string().min(1),
  marketerId: z.string().min(1).optional(),
});

export const wishlistFollowUpMutationSchema = z.object({
  assignedStaffId: z.string().min(1).optional().or(z.literal("")).transform((value) => value || undefined),
  followUpStatus: wishlistFollowUpStatusSchema,
  followUpNote: z.string().trim().max(600).optional().or(z.literal("")).transform((value) => value || undefined),
});

export type SavedPropertyMutationInput = z.infer<typeof savedPropertyMutationSchema>;
export type WishlistFollowUpMutationInput = z.infer<typeof wishlistFollowUpMutationSchema>;
