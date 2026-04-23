import { z } from "zod";

const optionalTrimmedString = z.string().trim().optional().transform((value) => value || undefined);

export const buyerProfileSchema = z.object({
  firstName: z.string().trim().min(2),
  lastName: z.string().trim().min(2),
  email: z.email(),
  phone: z.string().trim().min(7),
  profileImageUrl: optionalTrimmedString,
  dateOfBirth: z.string().date().optional(),
  nationality: z.string().trim().min(2),
  addressLine1: z.string().trim().min(5),
  addressLine2: optionalTrimmedString,
  city: z.string().trim().min(2),
  state: z.string().trim().min(2),
  country: z.string().trim().min(2).default("Nigeria"),
  occupation: z.string().trim().min(2),
  nextOfKinName: z.string().trim().min(2),
  nextOfKinPhone: z.string().trim().min(7),
});

export type BuyerProfileInput = z.infer<typeof buyerProfileSchema>;
