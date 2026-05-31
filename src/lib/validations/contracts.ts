import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((value) => value || undefined);

export const contractSettingsSchema = z.object({
  ceoName: z.string().trim().min(2),
  ceoTitle: z.string().trim().min(2),
  signatureKey: optionalString,
  stampKey: optionalString,
  contractTerms: optionalString,
  footerLegalText: optionalString,
});

export type ContractSettingsInput = z.infer<typeof contractSettingsSchema>;
