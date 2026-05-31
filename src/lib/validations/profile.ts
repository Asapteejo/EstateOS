import { z } from "zod";

const optionalTrimmedString = z.string().trim().optional().transform((value) => value || undefined);

export const buyerProfileSchema = z.object({
  firstName: z.string().trim().min(2),
  lastName: z.string().trim().min(2),
  email: z.email(),
  phone: z.string().trim().min(7),
  profileImageUrl: optionalTrimmedString,
  dateOfBirth: z.string().date().optional(),
  nationality: optionalTrimmedString,
  addressLine1: optionalTrimmedString,
  addressLine2: optionalTrimmedString,
  city: optionalTrimmedString,
  state: optionalTrimmedString,
  country: z.string().trim().min(2).default("Nigeria"),
  occupation: optionalTrimmedString,
  nextOfKinName: optionalTrimmedString,
  nextOfKinPhone: optionalTrimmedString,
}).superRefine((value, ctx) => {
  const hasAddress = Boolean(value.addressLine1);
  const hasCityState = Boolean(value.city && value.state);

  if (!hasAddress && !hasCityState) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter an address or city and state.",
      path: ["addressLine1"],
    });
  }
});

export type BuyerProfileInput = z.infer<typeof buyerProfileSchema>;
