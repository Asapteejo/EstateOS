import { z } from "zod";

export const savedPropertyMutationSchema = z.object({
  propertyId: z.string().min(1),
});

export type SavedPropertyMutationInput = z.infer<typeof savedPropertyMutationSchema>;
